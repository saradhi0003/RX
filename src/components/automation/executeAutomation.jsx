import { AutomationRule } from "@/entities/AutomationRule";
import { Candidate } from "@/entities/Candidate";
import { Company } from "@/entities/Company";
import { EmailTemplate } from "@/entities/EmailTemplate";
import { Job } from "@/entities/Job";
import { Recruiter } from "@/entities/Recruiter";
import { Task } from "@/entities/Task";
import { sendAppEmail } from "@/components/utils/email";

/**
 * Execute automation rules when a submission/application status changes
 */
export async function executeAutomationRules(entityName, entityId, oldData, newData) {
  try {
    // Get all active automation rules
    const rules = await AutomationRule.filter({ 
      is_active: true,
      trigger_entity: entityName,
      trigger_type: "status_change"
    });

    if (!rules || rules.length === 0) return;

    // Check which rules should be triggered
    const triggeredRules = rules.filter(rule => {
      // Status must have changed
      if (oldData?.status === newData?.status) return false;
      
      // New status must match trigger
      if (rule.trigger_status_to !== newData.status) return false;
      
      // If specified, old status must match trigger
      if (rule.trigger_status_from && rule.trigger_status_from !== oldData?.status) return false;
      
      return true;
    });

    // Execute each triggered rule
    for (const rule of triggeredRules) {
      try {
        await executeRule(rule, entityName, entityId, newData);
        
        // Update trigger count and last triggered
        await AutomationRule.update(rule.id, {
          trigger_count: (rule.trigger_count || 0) + 1,
          last_triggered: new Date().toISOString()
        });
      } catch (error) {
        console.error(`Failed to execute rule ${rule.id}:`, error);
      }
    }
  } catch (error) {
    console.error("Error executing automation rules:", error);
  }
}

/**
 * Execute a single automation rule
 */
async function executeRule(rule, entityName, entityId, entityData) {
  if (rule.delay_minutes > 0) {
    // For delayed execution, you'd typically use a job queue
    // For now, we'll use setTimeout (not recommended for production)
    setTimeout(() => executeRuleAction(rule, entityName, entityId, entityData), rule.delay_minutes * 60 * 1000);
  } else {
    await executeRuleAction(rule, entityName, entityId, entityData);
  }
}

/**
 * Execute the action defined in the rule
 */
async function executeRuleAction(rule, entityName, entityId, entityData) {
  if (rule.action_type === "send_email") {
    await sendAutomatedEmail(rule, entityName, entityId, entityData);
  } else if (rule.action_type === "create_task") {
    await createAutomatedTask(rule, entityName, entityId, entityData);
  } else if (rule.action_type === "send_notification") {
    // Placeholder for notifications
    console.log("Notification action not yet implemented");
  }
}

/**
 * Send automated email based on rule
 */
async function sendAutomatedEmail(rule, entityName, entityId, entityData) {
  try {
    // Get email template
    const template = await EmailTemplate.get(rule.email_template_id);
    if (!template) {
      console.error("Email template not found:", rule.email_template_id);
      return;
    }

    // Get related data
    let candidate = null;
    let job = null;
    let company = null;
    let recruiter = null;

    if (entityName === "Submission" || entityName === "Application") {
      if (entityData.candidate_id) {
        candidate = await Candidate.get(entityData.candidate_id).catch(() => null);
      }
      if (entityData.job_id) {
        job = await Job.get(entityData.job_id).catch(() => null);
      }
      if (job?.company_id) {
        company = await Company.get(job.company_id).catch(() => null);
      }
      if (entityData.recruiter_id) {
        recruiter = await Recruiter.get(entityData.recruiter_id).catch(() => null);
      }
    }

    // Determine recipient
    let recipientEmail = null;
    if (rule.email_recipient_type === "candidate" && candidate) {
      recipientEmail = candidate.email;
    } else if (rule.email_recipient_type === "hiring_manager" && job) {
      recipientEmail = job.hiring_manager; // Assuming this is an email
    } else if (rule.email_recipient_type === "recruiter" && recruiter) {
      recipientEmail = recruiter.email;
    } else if (rule.email_recipient_type === "custom") {
      recipientEmail = rule.email_custom_recipient;
    }

    if (!recipientEmail) {
      console.error("No recipient email found for rule:", rule.id);
      return;
    }

    // Build template variables
    const variables = {
      candidate_name: candidate ? `${candidate.first_name} ${candidate.last_name}` : "",
      job_title: job?.title || "",
      company_name: company?.name || "",
      recruiter_name: recruiter ? `${recruiter.first_name} ${recruiter.last_name}` : "",
      status: entityData.status?.replace("_", " ") || "",
      interview_type: "Video Call", // Could be enhanced
      hiring_manager_name: job?.hiring_manager || "",
      dashboard_link: window.location.origin
    };

    // Replace variables in subject and body
    let subject = template.subject || "";
    let body = template.html_body || "";
    
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      subject = subject.replace(regex, value);
      body = body.replace(regex, value);
    });

    // Send email
    await sendAppEmail({
      to: recipientEmail,
      subject,
      body
    });

    console.log(`Automated email sent to ${recipientEmail} for rule ${rule.id}`);
  } catch (error) {
    console.error("Error sending automated email:", error);
    throw error;
  }
}

/**
 * Create automated task based on rule
 */
async function createAutomatedTask(rule, entityName, entityId, entityData) {
  try {
    const taskData = {
      title: `Follow up on ${entityName} - ${entityData.status}`,
      description: `Automated task created for ${entityName} ${entityId}`,
      related_entity: entityName.toLowerCase(),
      related_id: entityId,
      status: "pending",
      priority: "medium",
      assigned_to: entityData.created_by || entityData.recruiter_id
    };

    await Task.create(taskData);
    console.log(`Automated task created for rule ${rule.id}`);
  } catch (error) {
    console.error("Error creating automated task:", error);
    throw error;
  }
}