import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { getStrengthsAndWeaknesses } from './insightService';

// Mock Supabase client
jest.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => ({
            limit: jest.fn(() => ({
              single: jest.fn(() => Promise.resolve({ data: null, error: null }))
            }))
          }))
        }))
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: { id: 'test-id', created_at: '2024-01-01' }, error: null }))
        }))
      }))
    }))
  }
}));

describe('InsightService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should limit strengths to maximum 3 items', async () => {
    // Mock data with many high-scoring areas
    const mockAssessments = [{
      id: '1',
      completed_at: '2024-01-01',
      creativity_score: 85,
      problem_solving: 80,
      pattern_recognition: 90,
      focus_duration: 75,
      task_switching: 85,
      emotional_regulation: 88,
      organization: 82,
      time_awareness: 78
    }];

    const { supabase } = await import('@/integrations/supabase/client');
    
    // Mock the assessment query
    (supabase.from as any).mockReturnValue({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => Promise.resolve({ 
            data: mockAssessments, 
            error: null 
          }))
        }))
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: { id: 'test-id', created_at: '2024-01-01' }, error: null }))
        }))
      }))
    });

    const result = await getStrengthsAndWeaknesses('test-user-id');
    
    expect(result.strengths).toBeDefined();
    expect(result.strengths.length).toBeLessThanOrEqual(3);
  });

  it('should limit weaknesses to maximum 3 items', async () => {
    // Mock data with many low-scoring areas
    const mockAssessments = [{
      id: '1',
      completed_at: '2024-01-01',
      creativity_score: 45,
      problem_solving: 40,
      pattern_recognition: 35,
      focus_duration: 50,
      task_switching: 30,
      emotional_regulation: 25,
      organization: 38,
      time_awareness: 42
    }];

    const { supabase } = await import('@/integrations/supabase/client');
    
    (supabase.from as any).mockReturnValue({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => Promise.resolve({ 
            data: mockAssessments, 
            error: null 
          }))
        }))
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: { id: 'test-id', created_at: '2024-01-01' }, error: null }))
        }))
      }))
    });

    const result = await getStrengthsAndWeaknesses('test-user-id');
    
    expect(result.weaknesses).toBeDefined();
    expect(result.weaknesses.length).toBeLessThanOrEqual(3);
  });

  it('should return empty arrays when no assessments exist', async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    
    (supabase.from as any).mockReturnValue({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => Promise.resolve({ 
            data: [], 
            error: null 
          }))
        }))
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: { id: 'test-id', created_at: '2024-01-01' }, error: null }))
        }))
      }))
    });

    const result = await getStrengthsAndWeaknesses('test-user-id');
    
    expect(result.strengths).toEqual([]);
    expect(result.weaknesses).toEqual([]);
    expect(result.generalInsight).toBe("Complete an assessment to see personalized insights.");
  });
});