
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export interface Insight {
  area: string;
  description: string;
}

export interface UserInsights {
  id?: string;
  strengths: Insight[];
  weaknesses: Insight[];
  generalInsight: string;
  createdAt?: string;
  assessmentId?: string;
}

interface AssessmentData {
  id: string;
  completed_at: string;
  creativity_score: number;
  problem_solving: number;
  pattern_recognition: number;
  focus_duration: number;
  task_switching: number;
  emotional_regulation: number;
  organization: number;
  time_awareness: number;
}

interface TechniqueInteraction {
  technique_id: string;
  technique_title: string;
  feedback: 'helpful' | 'not-helpful' | null;
  created_at: string;
}

// Analyze historical assessment patterns
const analyzeHistoricalPatterns = (assessments: AssessmentData[]) => {
  if (assessments.length === 0) return {};

  const cognitiveFields = [
    'creativity_score', 'problem_solving', 'pattern_recognition',
    'focus_duration', 'task_switching', 'emotional_regulation',
    'organization', 'time_awareness'
  ];

  const patterns: Record<string, { average: number; trend: 'improving' | 'declining' | 'stable'; consistency: number }> = {};

  cognitiveFields.forEach(field => {
    const values = assessments.map(a => a[field as keyof AssessmentData] as number);
    const average = values.reduce((sum, val) => sum + val, 0) / values.length;
    
    // Calculate trend (comparing first half to second half if enough data)
    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (values.length >= 4) {
      const midPoint = Math.floor(values.length / 2);
      const firstHalf = values.slice(0, midPoint);
      const secondHalf = values.slice(midPoint);
      const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
      
      if (secondAvg > firstAvg + 5) trend = 'improving';
      else if (secondAvg < firstAvg - 5) trend = 'declining';
    }
    
    // Calculate consistency (inverse of standard deviation)
    const variance = values.reduce((sum, val) => sum + Math.pow(val - average, 2), 0) / values.length;
    const consistency = Math.max(0, 100 - Math.sqrt(variance));
    
    patterns[field] = { average, trend, consistency };
  });

  return patterns;
};

// Analyze technique interaction patterns
const analyzeTechniquePatterns = (interactions: TechniqueInteraction[]) => {
  const techniqueStats: Record<string, { 
    helpful: number; 
    notHelpful: number; 
    totalInteractions: number;
    categories: string[];
  }> = {};

  interactions.forEach(interaction => {
    const key = interaction.technique_id;
    if (!techniqueStats[key]) {
      techniqueStats[key] = { helpful: 0, notHelpful: 0, totalInteractions: 0, categories: [] };
    }
    
    techniqueStats[key].totalInteractions++;
    if (interaction.feedback === 'helpful') techniqueStats[key].helpful++;
    if (interaction.feedback === 'not-helpful') techniqueStats[key].notHelpful++;
  });

  return techniqueStats;
};

// Calculate priority score for cognitive areas based on multiple factors
const calculatePriorityScore = (
  area: { 
    field: string; 
    value: number; 
    pattern?: { average: number; trend: string; consistency: number };
  }, 
  patterns: Record<string, { average: number; trend: string; consistency: number }>, 
  allAssessments: AssessmentData[]
) => {
  let score = area.value;
  
  // Pattern-based adjustments
  if (area.pattern) {
    // Reward improving trends
    if (area.pattern.trend === 'improving') score += 15;
    else if (area.pattern.trend === 'declining') score -= 10;
    
    // Reward consistency
    if (area.pattern.consistency > 80) score += 8;
    else if (area.pattern.consistency < 40) score -= 5;
    
    // Use historical context
    if (area.pattern.average) {
      const historicalWeight = Math.min(allAssessments.length / 10, 0.3);
      score = score * (1 - historicalWeight) + area.pattern.average * historicalWeight;
    }
  }
  
  // Recency bias - recent assessments matter more
  if (allAssessments.length > 1) {
    const recentTrend = allAssessments.slice(0, 3).map(a => a[area.field as keyof AssessmentData] as number);
    if (recentTrend.length >= 2) {
      const recentChange = recentTrend[0] - recentTrend[recentTrend.length - 1];
      score += recentChange * 0.2;
    }
  }
  
  return Math.max(0, Math.min(100, score));
};

// Get the latest insights or generate new ones
export const getStrengthsAndWeaknesses = async (userId: string): Promise<UserInsights> => {
  try {
    // Fetch ALL assessment data for pattern analysis
    const { data: allAssessments, error: assessmentError } = await supabase
      .from('assessment_results')
      .select('*')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false });
    
    if (assessmentError) {
      console.error('Error fetching assessment data:', assessmentError);
      throw new Error('Failed to fetch assessment data');
    }
    
    if (!allAssessments || allAssessments.length === 0) {
      return {
        strengths: [],
        weaknesses: [],
        generalInsight: "Complete an assessment to see personalized insights."
      };
    }

    // Fetch technique interactions for additional context
    const { data: techniqueInteractions, error: techniqueError } = await supabase
      .from('technique_interactions')
      .select('technique_id, technique_title, feedback, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (techniqueError) {
      console.error('Error fetching technique interactions:', techniqueError);
    }

    // Use the latest assessment as primary data source
    const latestAssessment = allAssessments[0];
    
    // Analyze patterns across all assessments
    const historicalPatterns = analyzeHistoricalPatterns(allAssessments);
    const techniquePatterns = analyzeTechniquePatterns(
      (techniqueInteractions || []).filter((interaction): interaction is TechniqueInteraction => 
        interaction && 
        typeof interaction.technique_id === 'string' &&
        typeof interaction.technique_title === 'string' &&
        (interaction.feedback === 'helpful' || interaction.feedback === 'not-helpful' || interaction.feedback === null) &&
        typeof interaction.created_at === 'string'
      )
    );
    
    // Map each attribute to a cognitive area with enhanced descriptions
    const cognitiveAreas = [
      {
        field: 'creativity_score',
        value: latestAssessment.creativity_score,
        pattern: historicalPatterns.creativity_score,
        area: 'Creativity',
        strengthDescription: 'You excel at generating original ideas and thinking outside the box.',
        growthDescription: 'Focus on developing creative thinking and innovative problem-solving approaches.'
      },
      {
        field: 'problem_solving',
        value: latestAssessment.problem_solving,
        pattern: historicalPatterns.problem_solving,
        area: 'Problem Solving',
        strengthDescription: 'You demonstrate strong abilities in finding solutions to complex challenges.',
        growthDescription: 'Work on developing systematic approaches to problem-solving and analytical thinking.'
      },
      {
        field: 'pattern_recognition',
        value: latestAssessment.pattern_recognition,
        pattern: historicalPatterns.pattern_recognition,
        area: 'Pattern Recognition',
        strengthDescription: 'You can easily identify connections and patterns where others might not see them.',
        growthDescription: 'Practice identifying patterns and connections in information and experiences.'
      },
      {
        field: 'focus_duration',
        value: latestAssessment.focus_duration,
        pattern: historicalPatterns.focus_duration,
        area: 'Focus Duration',
        strengthDescription: 'You maintain excellent concentration for extended periods.',
        growthDescription: 'Improve your ability to maintain concentration for extended periods.'
      },
      {
        field: 'task_switching',
        value: latestAssessment.task_switching,
        pattern: historicalPatterns.task_switching,
        area: 'Task Switching',
        strengthDescription: 'You transition smoothly between different activities while maintaining focus.',
        growthDescription: 'Work on transitioning between different activities smoothly without losing focus.'
      },
      {
        field: 'emotional_regulation',
        value: latestAssessment.emotional_regulation,
        pattern: historicalPatterns.emotional_regulation,
        area: 'Emotional Regulation',
        strengthDescription: 'You manage emotional responses effectively in challenging situations.',
        growthDescription: 'Develop strategies to better manage emotional responses to stressors.'
      },
      {
        field: 'organization',
        value: latestAssessment.organization,
        pattern: historicalPatterns.organization,
        area: 'Organization',
        strengthDescription: 'You maintain excellent organization in tasks, environment, and information.',
        growthDescription: 'Create systems to better organize your tasks, environment, and information.'
      },
      {
        field: 'time_awareness',
        value: latestAssessment.time_awareness,
        pattern: historicalPatterns.time_awareness,
        area: 'Time Awareness',
        strengthDescription: 'You have strong skills in estimating and managing time effectively.',
        growthDescription: 'Build skills to better estimate and manage time for various activities.'
      }
    ];
    
    // Enhanced algorithm for determining strengths and weaknesses using AI-like scoring
    const STRENGTH_THRESHOLD = 70;
    
    // Calculate sophisticated priority scores for each area
    const scoredAreas = cognitiveAreas.map(item => {
      const priorityScore = calculatePriorityScore(item, historicalPatterns, allAssessments);
      
      return {
        ...item,
        priorityScore,
        isStrength: priorityScore >= STRENGTH_THRESHOLD,
        isWeakness: priorityScore < STRENGTH_THRESHOLD
      };
    });

    // Smart selection algorithm - prioritize most impactful areas
    const potentialStrengths = scoredAreas
      .filter(item => item.isStrength)
      .sort((a, b) => {
        // Primary sort by priority score
        if (Math.abs(a.priorityScore - b.priorityScore) > 5) {
          return b.priorityScore - a.priorityScore;
        }
        // Secondary sort by consistency (for reliable strengths)
        return (b.pattern?.consistency || 0) - (a.pattern?.consistency || 0);
      })
      .slice(0, 3)
      .map(item => ({
        area: item.area,
        description: item.strengthDescription
      }));

    const potentialWeaknesses = scoredAreas
      .filter(item => item.isWeakness)
      .sort((a, b) => {
        // For weaknesses, prioritize areas with improvement potential
        const aImprovement = a.pattern?.trend === 'improving' ? 10 : 0;
        const bImprovement = b.pattern?.trend === 'improving' ? 10 : 0;
        
        // Prefer areas that are improving (more actionable) or significantly low
        const aScore = a.priorityScore + aImprovement;
        const bScore = b.priorityScore + bImprovement;
        
        // Sort ascending (lowest scores first, but with improvement bonus)
        return aScore - bScore;
      })
      .slice(0, 3)
      .map(item => ({
        area: item.area,
        description: item.growthDescription
      }));

    // Final selections with guaranteed limits
    const strengths = potentialStrengths.slice(0, 3);
    const weaknesses = potentialWeaknesses.slice(0, 3);
    
    // Generate enhanced general insight based on patterns and interactions
    const formattedDate = format(new Date(latestAssessment.completed_at), 'dd/MM/yyyy');
    const currentHour = new Date().getHours();
    const timeContext = currentHour < 12 ? "morning" : 
                         currentHour < 18 ? "afternoon" : "evening";
    
    // Include pattern analysis in insight
    const assessmentCount = allAssessments.length;
    const improvingAreas = Object.entries(historicalPatterns)
      .filter(([_, pattern]) => pattern.trend === 'improving')
      .map(([field, _]) => cognitiveAreas.find(area => area.field === field)?.area)
      .filter(Boolean);
    
    const helpfulTechniques = Object.entries(techniquePatterns)
      .filter(([_, stats]) => stats.helpful > stats.notHelpful && stats.helpful > 0)
      .length;

    // Enhanced insight generation
    const strengthsPhrase = strengths.length > 0 
      ? `your key strengths are ${strengths.map(s => s.area).join(", ")}` 
      : "you're developing strengths across multiple areas";
    
    const weaknessesPhrase = weaknesses.length > 0 
      ? `focusing on ${weaknesses.map(w => w.area).join(", ")} will help you progress further` 
      : "you're performing well across all assessed areas";

    const patternPhrase = improvingAreas.length > 0 
      ? ` Your ${improvingAreas.join(" and ")} ${improvingAreas.length > 1 ? 'are' : 'is'} showing positive trends over time.`
      : "";

    const techniquePhrase = helpfulTechniques > 0 
      ? ` Based on your interactions, you've found ${helpfulTechniques} technique${helpfulTechniques > 1 ? 's' : ''} particularly helpful.`
      : "";

    const insightTemplates = [
      `Based on ${assessmentCount} assessment${assessmentCount > 1 ? 's' : ''} and your latest results from ${formattedDate}, ${strengthsPhrase}. ${weaknessesPhrase}.${patternPhrase}${techniquePhrase}`,
      `Your journey shows that ${strengthsPhrase}, with data from ${assessmentCount} assessment${assessmentCount > 1 ? 's' : ''} including ${formattedDate}. To continue growing, ${weaknessesPhrase}.${patternPhrase}${techniquePhrase}`,
      `Analysis of your ${assessmentCount} assessment${assessmentCount > 1 ? 's' : ''} (latest: ${formattedDate}) reveals ${strengthsPhrase}. For optimal progress, ${weaknessesPhrase}.${patternPhrase}${techniquePhrase}`
    ];
    
    const generalInsight = insightTemplates[Math.floor(Math.random() * insightTemplates.length)];
    
    // Save the new insights to the history table
    const insightToSave = {
      user_id: userId,
      general_insight: generalInsight,
      strengths: strengths,
      weaknesses: weaknesses,
      assessment_id: latestAssessment.id
    };
    
    const { data: savedInsight, error: saveError } = await supabase
      .from('user_insight_history')
      .insert(insightToSave)
      .select('id, created_at')
      .single();
    
    if (saveError) {
      console.error('Error saving insight history:', saveError);
    }
    
    return {
      id: savedInsight?.id,
      strengths,
      weaknesses,
      generalInsight,
      createdAt: savedInsight?.created_at,
      assessmentId: latestAssessment.id
    };
  } catch (error) {
    console.error('Error in getStrengthsAndWeaknesses:', error);
    return {
      strengths: [],
      weaknesses: [],
      generalInsight: "We're having trouble analyzing your data. Please try again later."
    };
  }
};

// Get the history of insights for a user
export const getInsightHistory = async (userId: string): Promise<UserInsights[]> => {
  try {
    const { data: history, error } = await supabase
      .from('user_insight_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) {
      console.error('Error fetching insight history:', error);
      throw error;
    }
    
    return history.map(item => ({
      id: item.id,
      generalInsight: item.general_insight,
      strengths: Array.isArray(item.strengths) 
        ? (item.strengths as unknown as Insight[]).filter(s => s && typeof s === 'object' && 'area' in s && 'description' in s)
        : [],
      weaknesses: Array.isArray(item.weaknesses) 
        ? (item.weaknesses as unknown as Insight[]).filter(w => w && typeof w === 'object' && 'area' in w && 'description' in w)
        : [],
      createdAt: item.created_at,
      assessmentId: item.assessment_id
    }));
  } catch (error) {
    console.error('Error in getInsightHistory:', error);
    return [];
  }
};
