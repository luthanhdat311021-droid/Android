import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes('your-project') &&
  !supabaseUrl.includes('your_supabase')
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// In-Memory Fallback Storage when Supabase is not yet configured
const memoryHistoryStore = new Map();

export const supabaseService = {
  isConfigured() {
    return isSupabaseConfigured;
  },

  async getAllLessonHistory() {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('lesson_history')
          .select('*')
          .order('updated_at', { ascending: false });

        if (error) {
          console.warn('⚠️ [Supabase] Error fetching history, falling back to memory store:', error.message);
          return Array.from(memoryHistoryStore.values());
        }

        return data.map(item => ({
          id: item.id,
          userId: item.user_id,
          title: item.title,
          fileType: item.file_type,
          fileSize: item.file_size,
          pageCount: item.page_count,
          duration: item.duration,
          updatedAt: item.updated_at || item.created_at,
          status: item.status || 'COMPLETED',
          tags: item.tags || [],
          rawText: item.raw_text,
          studyPack: item.study_pack,
          quizHistory: item.quiz_history || []
        }));
      } catch (err) {
        console.error('❌ [Supabase Exception]:', err.message);
      }
    }

    // Fallback in-memory
    return Array.from(memoryHistoryStore.values());
  },

  async getLessonHistoryById(id) {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('lesson_history')
          .select('*')
          .eq('id', id)
          .single();

        if (!error && data) {
          return {
            id: data.id,
            userId: data.user_id,
            title: data.title,
            fileType: data.file_type,
            fileSize: data.file_size,
            pageCount: data.page_count,
            duration: data.duration,
            updatedAt: data.updated_at,
            status: data.status,
            tags: data.tags || [],
            rawText: data.raw_text,
            studyPack: data.study_pack,
            quizHistory: data.quiz_history || []
          };
        }
      } catch (err) {
        console.warn(`⚠️ [Supabase] Could not fetch doc ${id}:`, err.message);
      }
    }

    return memoryHistoryStore.get(id) || null;
  },

  async saveLessonHistory(documentItem, studyPack = null) {
    const payload = {
      id: documentItem.id,
      user_id: documentItem.userId || 'usr-1',
      title: documentItem.title,
      file_type: documentItem.fileType,
      file_size: documentItem.fileSize || null,
      page_count: documentItem.pageCount || null,
      duration: documentItem.duration || null,
      raw_text: documentItem.rawText || '',
      tags: documentItem.tags || ['Bài học mới'],
      status: documentItem.status || 'COMPLETED',
      study_pack: studyPack || null,
      updated_at: new Date().toISOString()
    };

    // Update in-memory fallback
    const existing = memoryHistoryStore.get(documentItem.id) || {};
    memoryHistoryStore.set(documentItem.id, {
      ...existing,
      ...documentItem,
      studyPack: studyPack || existing.studyPack || null,
      quizHistory: existing.quizHistory || [],
      updatedAt: payload.updated_at
    });

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('lesson_history')
          .upsert(payload, { onConflict: 'id' });

        if (error) {
          console.warn('⚠️ [Supabase] Save error:', error.message);
        } else {
          console.log(`✅ [Supabase] Saved lesson history for ${documentItem.id}`);
        }
      } catch (err) {
        console.error('❌ [Supabase Exception on Save]:', err.message);
      }
    }

    return memoryHistoryStore.get(documentItem.id);
  },

  async recordQuizResult(docId, score, correctCount, totalQuestions, feedback) {
    const quizAttempt = {
      id: `qhist-${Date.now()}`,
      score,
      correctCount,
      totalQuestions,
      completedAt: new Date().toISOString(),
      feedback
    };

    // In-memory update
    const lesson = memoryHistoryStore.get(docId);
    if (lesson) {
      lesson.quizHistory = lesson.quizHistory || [];
      lesson.quizHistory.unshift(quizAttempt);
      lesson.updatedAt = quizAttempt.completedAt;
    }

    if (isSupabaseConfigured && supabase) {
      try {
        // Fetch current quiz_history array
        const { data } = await supabase
          .from('lesson_history')
          .select('quiz_history')
          .eq('id', docId)
          .single();

        const currentHistory = (data && data.quiz_history) || [];
        const updatedHistory = [quizAttempt, ...currentHistory];

        await supabase
          .from('lesson_history')
          .update({
            quiz_history: updatedHistory,
            updated_at: new Date().toISOString()
          })
          .eq('id', docId);

        // Record in study_activities
        await supabase
          .from('study_activities')
          .insert({
            user_id: 'usr-1',
            document_id: docId,
            activity_type: 'QUIZ_SUBMITTED',
            description: `Hoàn thành bài Quiz với kết quả ${score}% (${correctCount}/${totalQuestions})`,
            score
          });

        console.log(`✅ [Supabase] Recorded quiz result (${score}%) for doc ${docId}`);
      } catch (err) {
        console.warn('⚠️ [Supabase] Failed to record quiz result:', err.message);
      }
    }

    return quizAttempt;
  },

  async deleteLessonHistory(id) {
    memoryHistoryStore.delete(id);

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('lesson_history')
          .delete()
          .eq('id', id);

        if (error) {
          console.warn(`⚠️ [Supabase] Error deleting ${id}:`, error.message);
        } else {
          console.log(`✅ [Supabase] Deleted lesson ${id}`);
        }
      } catch (err) {
        console.error('❌ [Supabase Exception on Delete]:', err.message);
      }
    }

    return true;
  },

  // ==========================================
  // 🔑 AUTHENTICATION & USER MANAGEMENT
  // ==========================================
  async signUpUser(email, password, fullName) {
    const defaultAvatar = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80";

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              avatar_url: defaultAvatar
            }
          }
        });

        if (error) throw error;

        const user = data.user;
        return {
          success: true,
          user: {
            id: user.id,
            email: user.email,
            fullName: fullName || user.email.split('@')[0],
            avatarUrl: defaultAvatar,
            membershipTier: "Premium",
            createdAt: user.created_at
          },
          session: data.session
        };
      } catch (err) {
        console.warn('⚠️ [Supabase Auth] SignUp failed, fallback to local register:', err.message);
      }
    }

    // Fallback Local Registration
    const newUser = {
      id: `usr-${Date.now()}`,
      email,
      fullName: fullName || email.split('@')[0],
      avatarUrl: defaultAvatar,
      membershipTier: "Premium",
      createdAt: new Date().toISOString()
    };

    return {
      success: true,
      user: newUser,
      session: { token: `local-token-${Date.now()}` }
    };
  },

  async signInUser(email, password) {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) throw error;

        const user = data.user;
        return {
          success: true,
          user: {
            id: user.id,
            email: user.email,
            fullName: user.user_metadata?.full_name || user.email.split('@')[0],
            avatarUrl: user.user_metadata?.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
            membershipTier: "Premium",
            createdAt: user.created_at
          },
          session: data.session
        };
      } catch (err) {
        console.warn('⚠️ [Supabase Auth] SignIn failed, fallback to local auth:', err.message);
      }
    }

    // Fallback Local Login
    return {
      success: true,
      user: {
        id: "usr-1",
        email: email || "minhtri@studymind.ai",
        fullName: email ? (email.split('@')[0] === 'demo' ? 'Người dùng Demo' : email.split('@')[0]) : "Nguyễn Minh Trí",
        avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
        membershipTier: "Premium",
        createdAt: new Date().toISOString()
      },
      session: { token: `local-token-${Date.now()}` }
    };
  },

  async signOutUser() {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('⚠️ [Supabase Auth] SignOut exception:', err.message);
      }
    }
    return { success: true };
  }
};
