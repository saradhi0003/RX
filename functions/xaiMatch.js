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

    // Initialize xAI client
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

    // Build candidates summary for batch processing
    const candidatesSummary = candidates.slice(0, 20).map((c, idx) => `
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

    const userPrompt = `Analyze the following candidates against this job opening and provide comprehensive matching analysis.

${jobContext}

CANDIDATES TO ANALYZE:
${candidatesSummary}

For each candidate, provide:
1. Overall match score (0-100)
2. Detailed strengths that align with the job
3. Gaps or concerns
4. Specific recommendations
5. Cultural fit assessment
6. Risk factors (relocation, visa, availability, etc.)

Be thorough, honest, and data-driven. Identify both obvious and subtle matches or mismatches.`;

    // Call xAI Grok model - using grok-beta
    const completion = await xaiClient.chat.completions.create({
      model: "grok-beta",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 4000,
    });

    const grokResponse = completion.choices[0]?.message?.content || '';

    // Parse Grok's response and structure it
    const structuredPrompt = `Based on your previous analysis, provide a structured JSON response for each candidate.

Return ONLY valid JSON in this exact format:
{
  "matches": [
    {
      "candidate_id": "string",
      "match_score": 85,
      "strengths": ["strength1", "strength2"],
      "gaps": ["gap1", "gap2"],
      "recommendation": "strong_hire",
      "cultural_fit_score": 80,
      "risk_factors": ["risk1"],
      "key_insight": "one sentence summary"
    }
  ],
  "overall_insights": "2-3 sentence summary of the candidate pool"
}

Recommendation must be one of: strong_hire, hire, maybe, pass
Match scores and cultural_fit_score must be numbers from 0-100.`;

    const structuredCompletion = await xaiClient.chat.completions.create({
      model: "grok-beta",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
        { role: "assistant", content: grokResponse },
        { role: "user", content: structuredPrompt }
      ],
      temperature: 0.2,
      max_tokens: 3000,
    });

    let structuredData;
    try {
      const content = structuredCompletion.choices[0]?.message?.content || '{}';
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
      const jsonString = jsonMatch ? jsonMatch[1] : content;
      structuredData = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('Failed to parse structured response:', parseError);
      // Return a basic structure with the narrative analysis
      structuredData = { 
        matches: candidates.slice(0, 20).map((c, idx) => ({
          candidate_id: c.id,
          match_score: 50,
          strengths: ["Analysis available in narrative section"],
          gaps: [],
          recommendation: "maybe",
          cultural_fit_score: 50,
          risk_factors: [],
          key_insight: `Candidate ${idx + 1}`
        })),
        overall_insights: 'See detailed narrative analysis below' 
      };
    }

    // Combine narrative and structured data
    return Response.json({
      success: true,
      job_id: job.id,
      job_title: job.title,
      analyzed_count: Math.min(candidates.length, 20),
      narrative_analysis: grokResponse,
      structured_matches: structuredData.matches || [],
      overall_insights: structuredData.overall_insights || '',
      model: "grok-beta (xAI)",
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('xAI Matching Error:', error);
    
    // Provide more detailed error information
    return Response.json({ 
      success: false,
      error: error.message || 'Failed to perform AI matching',
      error_type: error.name || 'Unknown',
      details: error.response?.data || error.stack
    }, { status: 500 });
  }
});