import { fetchRandomQuestions, sampleQuestions } from './AssessmentData';

// Mock the supabase client
const mockSupabaseData = [
  { id: '1', question_text: 'Question 1', category: 'attention', score_type: 'frequency', source: 'ADHD UK' },
  { id: '2', question_text: 'Question 2', category: 'hyperactivity', score_type: 'agreement', source: 'NHS' },
  { id: '3', question_text: 'Question 3', category: 'organization', score_type: 'frequency', source: 'ADHD UK' },
  { id: '4', question_text: 'Question 4', category: 'attention', score_type: 'scale', source: 'NHS' },
  { id: '5', question_text: 'Question 5', category: 'impulsivity', score_type: 'frequency', source: 'ADHD UK' }
];

jest.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        order: jest.fn(() => ({
          limit: jest.fn(() => Promise.resolve({ 
            data: mockSupabaseData, 
            error: null 
          }))
        }))
      }))
    }))
  }
}));

describe('fetchRandomQuestions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch questions from the correct table name', async () => {
    const { supabase } = require('@/integrations/supabase/client');
    
    await fetchRandomQuestions(5);
    
    expect(supabase.from).toHaveBeenCalledWith('adhd_screening_questions');
  });

  it('should use random ordering in the query', async () => {
    const { supabase } = require('@/integrations/supabase/client');
    const mockOrder = jest.fn(() => ({
      limit: jest.fn(() => Promise.resolve({ data: [], error: null }))
    }));
    const mockSelect = jest.fn(() => ({
      order: mockOrder
    }));
    supabase.from.mockReturnValue({
      select: mockSelect
    });
    
    await fetchRandomQuestions(5);
    
    expect(mockOrder).toHaveBeenCalledWith('random()');
  });

  it('should request the correct number of questions', async () => {
    const { supabase } = require('@/integrations/supabase/client');
    const mockLimit = jest.fn(() => Promise.resolve({ data: [], error: null }));
    const mockOrder = jest.fn(() => ({ limit: mockLimit }));
    const mockSelect = jest.fn(() => ({ order: mockOrder }));
    supabase.from.mockReturnValue({ select: mockSelect });
    
    await fetchRandomQuestions(3);
    
    expect(mockLimit).toHaveBeenCalledWith(3);
  });

  it('should return sample questions when database query fails', async () => {
    const { supabase } = require('@/integrations/supabase/client');
    const mockLimit = jest.fn(() => Promise.resolve({ 
      data: null, 
      error: { message: 'Database error' } 
    }));
    const mockOrder = jest.fn(() => ({ limit: mockLimit }));
    const mockSelect = jest.fn(() => ({ order: mockOrder }));
    supabase.from.mockReturnValue({ select: mockSelect });
    
    const result = await fetchRandomQuestions(5);
    
    expect(result).toEqual(sampleQuestions);
  });

  it('should transform database questions into expected UI format', async () => {
    // Reset the mock to ensure it returns our test data
    const { supabase } = require('@/integrations/supabase/client');
    const mockLimit = jest.fn(() => Promise.resolve({ 
      data: mockSupabaseData, 
      error: null 
    }));
    const mockOrder = jest.fn(() => ({ limit: mockLimit }));
    const mockSelect = jest.fn(() => ({ order: mockOrder }));
    supabase.from.mockReturnValue({ select: mockSelect });

    const result = await fetchRandomQuestions(5);
    
    expect(result).toHaveLength(5);
    expect(result[0]).toHaveProperty('id');
    expect(result[0]).toHaveProperty('text');
    expect(result[0]).toHaveProperty('type');
    expect(result[0]).toHaveProperty('options');
    expect(result[0]).toHaveProperty('category');
    expect(result[0]).toHaveProperty('source');
  });

  it('should set correct question type and options based on score_type', async () => {
    // Reset the mock to ensure it returns our test data
    const { supabase } = require('@/integrations/supabase/client');
    const mockLimit = jest.fn(() => Promise.resolve({ 
      data: mockSupabaseData, 
      error: null 
    }));
    const mockOrder = jest.fn(() => ({ limit: mockLimit }));
    const mockSelect = jest.fn(() => ({ order: mockOrder }));
    supabase.from.mockReturnValue({ select: mockSelect });

    const result = await fetchRandomQuestions(5);
    
    // Check frequency type question (score_type: 'frequency')
    const frequencyQuestion = result.find(q => q.category === 'attention' && q.source === 'ADHD UK');
    expect(frequencyQuestion?.type).toBe('multiple-choice');
    expect(frequencyQuestion?.options).toEqual([
      { value: 0, label: 'Never' },
      { value: 1, label: 'Rarely' },
      { value: 2, label: 'Sometimes' },
      { value: 3, label: 'Often' },
      { value: 4, label: 'Very Often' }
    ]);

    // Check agreement type question (score_type: 'agreement')
    const agreementQuestion = result.find(q => q.category === 'hyperactivity' && q.source === 'NHS');
    expect(agreementQuestion?.type).toBe('multiple-choice');
    expect(agreementQuestion?.options).toEqual([
      { value: 0, label: 'Strongly Disagree' },
      { value: 1, label: 'Disagree' },
      { value: 2, label: 'Neutral' },
      { value: 3, label: 'Agree' },
      { value: 4, label: 'Strongly Agree' }
    ]);
  });
});