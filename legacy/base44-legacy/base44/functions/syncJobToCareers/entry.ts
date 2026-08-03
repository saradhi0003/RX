import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { job_id } = await req.json();

    if (!job_id) {
      return Response.json({ error: 'job_id is required' }, { status: 400 });
    }

    // Get the job details
    const job = await base44.entities.Job.get(job_id);

    if (!job) {
      return Response.json({ error: 'Job not found' }, { status: 404 });
    }

    // Only sync if job is open/active
    if (job.status !== 'open') {
      return Response.json({ 
        success: false, 
        message: 'Job is not open, skipping sync to careers page' 
      });
    }

    // Get company details
    let companyName = 'Company';
    if (job.company_id) {
      try {
        const company = await base44.entities.Company.get(job.company_id);
        if (company) {
          companyName = company.name;
        }
      } catch (e) {
        console.warn('Failed to fetch company:', e);
      }
    }

    // Prepare the careers job payload
    const careersJobData = {
      title: job.title,
      company: companyName,
      location: job.location || 'Remote',
      employment_type: job.employment_type || 'full_time',
      description: job.description || '',
      requirements: job.requirements || '',
      salary_range: job.rate || (job.salary_min && job.salary_max 
        ? `$${job.salary_min.toLocaleString()} - $${job.salary_max.toLocaleString()}`
        : ''),
      remote_type: job.remote_type || 'onsite',
      required_skills: job.required_skills || [],
      preferred_skills: job.preferred_skills || [],
      experience_required: job.experience_required || 0,
      status: 'active',
      source_job_id: job.id,
      posted_date: new Date().toISOString()
    };

    // Post to the TalentStack careers page API
    // Replace this URL with the actual API endpoint from the careers app
    const careersApiUrl = 'https://talentstack.org/api/jobs'; // TODO: Update with actual endpoint
    
    const response = await fetch(careersApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add authentication headers if needed
        // 'Authorization': `Bearer ${Deno.env.get('CAREERS_API_KEY')}`
      },
      body: JSON.stringify(careersJobData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Careers API error:', errorText);
      return Response.json({ 
        success: false, 
        error: `Failed to sync to careers page: ${response.status}` 
      }, { status: 500 });
    }

    const result = await response.json();

    return Response.json({ 
      success: true, 
      message: 'Job synced to careers page successfully',
      careers_job: result
    });

  } catch (error) {
    console.error('Error syncing job to careers:', error);
    return Response.json({ 
      error: error.message,
      success: false 
    }, { status: 500 });
  }
});