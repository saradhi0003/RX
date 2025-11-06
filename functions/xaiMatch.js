import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';
import OpenAI from 'npm:openai@4.47.1';

const XAI_API_KEY = Deno.env.get("XAI_API_KEY");

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { job, candidates, matchType = "comprehensive" } = payload;

    if (!job) {
      return Response.json({ error: 'Job is required' }, { status: 400 });
    }

    if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
      return Response.json({ error: 'Candidates array is required' }, { status: 400 });
    }

    // Initialize xAI client with Grok
    const xaiClient = new OpenAI({
      apiKey: XAI_API_KEY,
      baseURL: "https://api.x.ai/v1",
    });

    // Build comprehensive job context
    const jobContext = `
Job Title: ${job.title}
Company: ${job.company_name || 'N/A'}
Location: ${job.location || 'N/A'}
Employment Type: ${job.employment_type || 'N/A'}
Remote Type: ${job.remote_type || 'N/A'}

Job Description:
${job.description || 'N/A'}

Required Skills: ${Array.isArray(job.required_skills) ? job.required_skills.join(', ') : 'N/A'}
Preferred Skills: ${Array.isArray(job.preferred_skills) ? job.preferred_skills.join(', ') : 'N/A'}
Experience Required: ${job.experience_required ? `${job.experience_required} years` : 'N/A'}
Priority: ${job.priority || 'medium'}
Status: ${job.status || 'open'}
`;

    // Limit to 15 candidates for better performance
    const candidatesToAnalyze = candidates.slice(0, 15);
    
    const candidatesSummary = candidatesToAnalyze.map((c, idx) => `
[Candidate ${idx + 1}]
ID: ${c.id}
Name: ${c.first_name} ${c.last_name}
Current Title: ${c.current_title || 'N/A'}
Current Company: ${c.current_company || 'N/A'}
Experience: ${c.experience_years ? `${c.experience_years} years` : 'N/A'}
Skills: ${Array.isArray(c.skills) ? c.skills.join(', ') : 'N/A'}
Location: ${c.location || 'N/A'}
Work Authorization: ${c.work_authorization || 'N/A'}
Availability: ${c.availability || 'N/A'}
Status: ${c.status || 'N/A'}
`).join('\n---\n');

    const systemPrompt = `You are Grok, an advanced AI recruitment expert powered by xAI. Your specialty is analyzing candidate-job fit with deep understanding of technical skills, experience relevance, and cultural alignment. You provide honest, detailed, and actionable insights.`;

    const userPrompt = `Analyze the following candidates against this job opening.

${jobContext}

CANDIDATES TO ANALYZE:
${candidatesSummary}

For each candidate, provide:
1. Overall match score (0-100)
2. Key strengths that align with the job
3. Gaps or concerns
4. Hiring recommendation (strong_hire/hire/maybe/pass)
5. Cultural fit score (0-100)
6. Risk factors if any
7. One-sentence key insight

Provide your analysis in valid JSON format ONLY. No markdown, no code blocks, just pure JSON:

{
  "matches": [
    {
      "candidate_id": "string",
      "match_score": 85,
      "strengths": ["strength1", "strength2"],
      "gaps": ["gap1"],
      "recommendation": "strong_hire",
      "cultural_fit_score": 80,
      "risk_factors": ["risk1"],
      "key_insight": "summary"
    }
  ],
  "overall_insights": "2-3 sentence summary"
}

Be thorough and honest. Use numbers 0-100 for scores. Use one of: strong_hire, hire, maybe, pass for recommendations.`;

    // Single API call with grok-3-latest model
    const completion = await xaiClient.chat.completions.create({
      model: "grok-beta",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 4000,
    });

    const grokResponse = completion.choices[0]?.message?.content || '';

    // Parse JSON response
    let structuredData;
    try {
      // Try to extract JSON from the response
      const jsonMatch = grokResponse.match(/```json\s*([\s\S]*?)\s*```/) || 
                        grokResponse.match(/```\s*([\s\S]*?)\s*```/) ||
                        grokResponse.match(/\{[\s\S]*\}/);
      
      const jsonString = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : grokResponse;
      structuredData = JSON.parse(jsonString);
      
      // Validate structure
      if (!structuredData.matches || !Array.isArray(structuredData.matches)) {
        throw new Error('Invalid response structure');
      }
    } catch (parseError) {
      console.error('Failed to parse Grok response:', parseError);
      console.error('Raw response:', grokResponse);
      
      // Create fallback structure
      structuredData = { 
        matches: candidatesToAnalyze.map((c, idx) => ({
          candidate_id: c.id,
          match_score: 50,
          strengths: ["See narrative analysis below"],
          gaps: ["Analysis in progress"],
          recommendation: "maybe",
          cultural_fit_score: 50,
          risk_factors: [],
          key_insight: `Candidate ${idx + 1} - ${c.first_name} ${c.last_name}`
        })),
        overall_insights: 'Analysis completed - see narrative section for details'
      };
    }

    // Return combined response
    return Response.json({
      success: true,
      job_id: job.id,
      job_title: job.title,
      analyzed_count: candidatesToAnalyze.length,
      narrative_analysis: grokResponse,
      structured_matches: structuredData.matches || [],
      overall_insights: structuredData.overall_insights || '',
      model: "grok-beta (xAI)",
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('xAI Matching Error:', error);
    
    // Detailed error response
    return Response.json({ 
      success: false,
      error: error.message || 'Failed to perform AI matching',
      error_type: error.name || 'Unknown',
      error_details: error.stack,
      hint: 'Check that XAI_API_KEY is set correctly'
    }, { status: 500 });
  }
});