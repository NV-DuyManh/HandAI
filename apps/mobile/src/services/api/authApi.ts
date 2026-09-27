import apiClient from './apiClient';
import { ENV } from '../../config/env';
import { tokenStorage } from '../auth/tokenStorage';

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user?: any;
}

export const DEMO_STUDENTS: Record<string, { name: string; gradeLevel: number }> = {
  'minh.student@mathvision.local': { name: 'Nguyễn Bình Minh', gradeLevel: 3 },
  'an.student@mathvision.local': { name: 'Trần Văn An', gradeLevel: 3 },
  'binh.student@mathvision.local': { name: 'Lê Thanh Bình', gradeLevel: 3 },
  'cuong.student@mathvision.local': { name: 'Phạm Quốc Cường', gradeLevel: 3 },
  'dung.student@mathvision.local': { name: 'Hoàng Ngọc Dũng', gradeLevel: 3 },
  'giang.student@mathvision.local': { name: 'Vũ Hương Giang', gradeLevel: 3 },
  'ha.student@mathvision.local': { name: 'Đỗ Thu Hà', gradeLevel: 3 },
  'khoa.student@mathvision.local': { name: 'Bùi Anh Khoa', gradeLevel: 3 },
  'linh.student@mathvision.local': { name: 'Ngô Phương Linh', gradeLevel: 3 },
  'mai.student@mathvision.local': { name: 'Đặng Tuyết Mai', gradeLevel: 3 },
  'nam.student@mathvision.local': { name: 'Dương Nhật Nam', gradeLevel: 3 },
};

export const getMockStudentUser = (email: string) => {
  const normEmail = (email || '').toLowerCase().trim();
  const demoInfo = DEMO_STUDENTS[normEmail];
  const name = demoInfo ? demoInfo.name : (normEmail ? normEmail.split('@')[0] : 'Học sinh');
  const gradeLevel = demoInfo ? demoInfo.gradeLevel : 3;

  return {
    userId: `mock_student_${normEmail.replace(/[^a-z0-9]/g, '_')}`,
    id: `mock_student_${normEmail.replace(/[^a-z0-9]/g, '_')}`,
    email: normEmail,
    displayName: name,
    name: name,
    role: 'STUDENT',
    gradeLevel: gradeLevel,
    grade: gradeLevel,
  };
};

export const authApi = {
  login: async (credentials: any): Promise<LoginResponse> => {
    let email = (credentials.email || '').trim();
    if (email.toLowerCase() === 'minh.student@gmail.com') {
      email = 'minh.student@mathvision.local';
    }
    const cleanCredentials = { ...credentials, email };

    // If not explicitly set to mock, attempt real backend first
    if (!ENV.USE_MOCK) {
      try {
        const response = await apiClient.post('/auth/login', cleanCredentials);
        return response.data;
      } catch (err: any) {
        // If the server answered with an HTTP error (like 401 Bad Credentials), rethrow it
        if (err.response && err.response.status === 401) {
          throw err;
        }
        // If the server is offline or connection refused (Network Error), DO NOT fall back to demo mode unless USE_MOCK is true.
        console.error('Backend server is unreachable. Authentication failed.', err.message);
        throw err;
      }
    }

    // Mock Demo Authentication
    const normEmail = email.toLowerCase().trim();
    const password = credentials.password || '';

    // Validate standard password
    if (password !== 'MathVision123!' && !password.includes('demo') && password.length < 3) {
      const error: any = new Error('Mật khẩu không đúng. Mật khẩu mặc định là MathVision123!');
      error.response = { data: { message: 'Mật khẩu không đúng. Mật khẩu mẫu là: MathVision123!' } };
      throw error;
    }

    const mockUser = getMockStudentUser(normEmail);
    return {
      accessToken: `demo_student_token_${Date.now()}`,
      refreshToken: `demo_student_refresh_${Date.now()}`,
      user: mockUser,
    };
  },

  logout: async (): Promise<void> => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // safe ignore in demo / offline mode
    }
  },

  getMe: async (): Promise<any> => {
    if (ENV.USE_MOCK) {
      const savedUser = await tokenStorage.getUser();
      if (savedUser) return savedUser;
      return getMockStudentUser('minh.student@mathvision.local');
    }
    try {
      const response = await apiClient.get('/me');
      return response.data;
    } catch (err: any) {
      // Re-throw so AuthContext can fall back to stored user data
      throw err;
    }
  },
};
