import { supabase } from '@/integrations/supabase/client';

export interface QuestionOption {
  value: number;
  label: string;
}

export interface Question {
  id: string;
  text: string;
  options: QuestionOption[];
  type: 'scale' | 'multiple-choice';
  category?: string;
  source?: string;
}

// Fallback questions in case database fetch fails
export const sampleQuestions = [
  {
    id: '1',
    text: 'How difficult was it to focus on tasks today?',
    type: 'scale' as const,
    options: [
      { value: 1, label: 'Not difficult' },
      { value: 2, label: '' },
      { value: 3, label: '' },
      { value: 4, label: '' },
      { value: 5, label: 'Very difficult' },
    ],
  },
  {
    id: '2',
    text: 'How would you rate your energy level today?',
    type: 'scale' as const,
    options: [
      { value: 1, label: 'Very low' },
      { value: 2, label: '' },
      { value: 3, label: '' },
      { value: 4, label: '' },
      { value: 5, label: 'Very high' },
    ],
  },
  {
    id: '3',
    text: 'Which of these best describes your ability to organize tasks today?',
    type: 'multiple-choice' as const,
    options: [
      { value: 1, label: 'I had significant difficulty organizing tasks' },
      { value: 2, label: 'I struggled somewhat with organization' },
      { value: 3, label: 'I was moderately organized' },
      { value: 4, label: 'I was well organized throughout the day' },
    ],
  },
  {
    id: '4',
    text: 'How often did you feel overwhelmed by sensory input today?',
    type: 'multiple-choice' as const,
    options: [
      { value: 1, label: 'Not at all' },
      { value: 2, label: 'Once or twice' },
      { value: 3, label: 'Several times' },
      { value: 4, label: 'Throughout most of the day' },
    ],
  },
  {
    id: '5',
    text: 'How would you rate your overall mood today?',
    type: 'scale' as const,
    options: [
      { value: 1, label: 'Very low' },
      { value: 2, label: '' },
      { value: 3, label: '' },
      { value: 4, label: '' },
      { value: 5, label: 'Very high' },
    ],
  },
];

/**
 * Function to fetch random questions from the database for daily assessment.
 * 
 * This function randomly selects questions from the ADHD screening questions database
 * to ensure that users get a varied set of questions each day. The randomization 
 * is achieved using SQL's RANDOM() function, which provides truly random selection
 * from the full pool of available questions.
 * 
 * @param count - Number of questions to fetch (default: 5)
 * @returns Promise<Question[]> - Array of randomly selected questions
 */
export const fetchRandomQuestions = async (count = 5): Promise<Question[]> => {
  try {
    const { data, error } = await supabase
      .from('adhd_screening_questions')
      .select('id, question_text, category, score_type, source')
      .order('random()')
      .limit(count);
    
    if (error) {
      console.error('Error fetching questions:', error);
      return sampleQuestions;
    }
    
    // Transform the database questions into the format expected by the UI
    return data.map(question => {
      // Determine question type and options based on score_type
      let type: 'scale' | 'multiple-choice' = 'scale';
      let options: QuestionOption[] = [];
      
      if (question.score_type === 'frequency') {
        type = 'multiple-choice';
        options = [
          { value: 0, label: 'Never' },
          { value: 1, label: 'Rarely' },
          { value: 2, label: 'Sometimes' },
          { value: 3, label: 'Often' },
          { value: 4, label: 'Very Often' }
        ];
      } else if (question.score_type === 'agreement') {
        type = 'multiple-choice';
        options = [
          { value: 0, label: 'Strongly Disagree' },
          { value: 1, label: 'Disagree' },
          { value: 2, label: 'Neutral' },
          { value: 3, label: 'Agree' },
          { value: 4, label: 'Strongly Agree' }
        ];
      } else {
        // Default to scale for other types
        type = 'scale';
        options = [
          { value: 1, label: 'Not at all' },
          { value: 2, label: '' },
          { value: 3, label: '' },
          { value: 4, label: '' },
          { value: 5, label: 'Very much' },
        ];
      }
      
      return {
        id: question.id,
        text: question.question_text,
        type,
        options,
        category: question.category,
        source: question.source
      };
    });
  } catch (error) {
    console.error('Unexpected error fetching questions:', error);
    return sampleQuestions;
  }
};