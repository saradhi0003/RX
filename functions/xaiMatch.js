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
    const candidatesSummary = candidates.map((c, idx) => `
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

    // Call xAI Grok model
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
    // For now, we'll also request a structured JSON response for easier processing
    const structuredPrompt = `Based on your previous analysis, provide a structured JSON response for each candidate with the following schema:

{
  "matches": [
    {
      "candidate_id": "string",
      "match_score": number (0-100),
      "strengths": ["string"],
      "gaps": ["string"],
      "recommendation": "string (strong_hire|hire|maybe|pass)",
      "cultural_fit_score": number (0-100),
      "risk_factors": ["string"],
      "key_insight": "string (one sentence summary)"
    }
  ],
  "overall_insights": "string (2-3 sentence summary of the candidate pool)"
}`;

    const structuredCompletion = await xaiClient.chat.completions.create({
      model: "grok-beta",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
        { role: "assistant", content: grokResponse },
        { role: "user", content: structuredPrompt }
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: "json_object" }
    });

    let structuredData;
    try {
      structuredData = JSON.parse(structuredCompletion.choices[0]?.message?.content || '{}');
    } catch (parseError) {
      console.error('Failed to parse structured response:', parseError);
      structuredData = { matches: [], overall_insights: '' };
    }

    // Combine narrative and structured data
    return Response.json({
      success: true,
      job_id: job.id,
      job_title: job.title,
      analyzed_count: candidates.length,
      narrative_analysis: grokResponse,
      structured_matches: structuredData.matches || [],
      overall_insights: structuredData.overall_insights || '',
      model: "grok-beta (xAI)",
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('xAI Matching Error:', error);
    return Response.json({ 
      error: error.message || 'Failed to perform AI matching',
      details: error.stack
    }, { status: 500 });
  }
});