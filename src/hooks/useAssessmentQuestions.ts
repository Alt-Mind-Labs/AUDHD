import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { sampleQuestions, fetchRandomQuestions, Question } from '@/components/assessment/AssessmentData';

/**
 * Hook for fetching random assessment questions for daily assessments.
 * 
 * This hook ensures that each time it's called, a new random set of questions
 * is fetched from the database. This provides daily variation in assessment
 * questions, improving user engagement and preventing question fatigue.
 * 
 * The randomization is handled at the database level using SQL RANDOM()
 * function, ensuring truly random selection from the full pool of ADHD
 * screening questions sourced from validated questionnaires.
 * 
 * @param count - Number of questions to fetch (default: 5)
 * @returns Object containing questions array and loading state
 */
export const useAssessmentQuestions = (count = 5) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  
  useEffect(() => {
    const loadQuestions = async () => {
      try {
        // Fetch random questions for daily assessment
        // Each call returns a different random set of questions
        const fetchedQuestions = await fetchRandomQuestions(count);
        setQuestions(fetchedQuestions);
      } catch (error) {
        console.error('Failed to load questions:', error);
        setQuestions(sampleQuestions);
        toast({
          title: "Failed to load questions",
          description: "Using default questions instead.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    
    loadQuestions();
  }, [count, toast]);
  
  return { questions, loading };
};