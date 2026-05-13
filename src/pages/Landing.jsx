import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Briefcase,
  Building2,
  TrendingUp,
  Brain,
  Zap,
  Shield,
  CheckCircle,
  Mail,
  Phone,
  Sparkles,
  BarChart3,
  FileText,
  MessageSquare,
  Calendar,
  Target,
  Clock,
  Award,
  Search,
  Upload,
  Send,
  X,
  Loader2,
  ArrowRight,
  Star,
  Globe
} from "lucide-react";
import * as Core from "@/integrations/Core";
import { addNotification } from "@/components/notifications/NotificationToast";

export default function Landing() {
  const [showTrialForm, setShowTrialForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    company_name: "",
    full_name: "",
    email: "",
    phone: "",
    company_size: "",
    message: ""
  });

  const handleTrialRequest = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Send trial request email to admin
      await Core.SendEmail({
        to: "admin@recruiterx.com", // Replace with your admin email
        subject: `Trial Access Request - ${formData.company_name}`,
        body: `
New Trial Access Request:

Company: ${formData.company_name}
Name: ${formData.full_name}
Email: ${formData.email}
Phone: ${formData.phone}
Company Size: ${formData.company_size}
Message: ${formData.message}

Please review and respond to this trial access request.
        `
      });

      // Send confirmation to requester
      await Core.SendEmail({
        to: formData.email,
        subject: "Trial Access Request Received - Recruiter X",
        body: `
Hi ${formData.full_name},

Thank you for your interest in Recruiter X!

We've received your trial access request and our team will review it shortly. You can expect to hear from us within 24 hours.

In the meantime, feel free to reply to this email if you have any questions.

Best regards,
The Recruiter X Team
        `
      });

      addNotification({
        type: "success",
        title: "Request Submitted",
        message: "We'll contact you within 24 hours!"
      });

      setShowTrialForm(false);
      setFormData({
        company_name: "",
        full_name: "",
        email: "",
        phone: "",
        company_size: "",
        message: ""
      });
    } catch (error) {
      console.error("Error submitting trial request:", error);
      addNotification({
        type: "error",
        title: "Submission Failed",
        message: "Please try again or contact support@recruiterx.com"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogin = () => {
    window.location.href = "/login";
  };

  const features = [
    {
      icon: Users,
      title: "Candidate Management",
      description: "Comprehensive candidate database with AI-powered matching, resume parsing, and automated enrichment",
      highlights: ["AI Resume Analysis", "Bulk Import", "Smart Search", "Status Tracking"]
    },
    {
      icon: Briefcase,
      title: "Job & Pipeline Management",
      description: "End-to-end job requisition management with intelligent candidate recommendations",
      highlights: ["Job Posting", "AI Matching", "Pipeline Stages", "Email Automation"]
    },
    {
      icon: Brain,
      title: "AI-Powered Intelligence",
      description: "Advanced AI features for screening, outreach, interview assistance, and talent analytics",
      highlights: ["Auto Screening", "Smart Outreach", "Interview AI", "Predictive Analytics"]
    },
    {
      icon: Building2,
      title: "Client & Company Management",
      description: "Manage client relationships, track interactions, and maintain detailed company profiles",
      highlights: ["Contact Management", "Job Stack Access", "Bulk Email", "Activity History"]
    },
    {
      icon: Zap,
      title: "Automation & Workflows",
      description: "Automate repetitive tasks with smart rules and AI-driven workflow suggestions",
      highlights: ["Auto Status Updates", "Email Triggers", "Task Creation", "Follow-up Reminders"]
    },
    {
      icon: FileText,
      title: "Resume Studio",
      description: "AI-powered resume builder, analyzer, and optimizer with version control",
      highlights: ["AI Resume Builder", "JD Comparison", "Version Control", "Skill Extraction"]
    },
    {
      icon: BarChart3,
      title: "Analytics & Reporting",
      description: "Real-time dashboards, pipeline analytics, and customizable reports",
      highlights: ["Custom Dashboards", "Pipeline Metrics", "Performance Tracking", "Trend Analysis"]
    },
    {
      icon: MessageSquare,
      title: "Communication Hub",
      description: "Integrated email, templates, and outreach campaign management",
      highlights: ["Email Templates", "Bulk Campaigns", "SMS Integration", "Response Tracking"]
    },
    {
      icon: Calendar,
      title: "Task & Activity Management",
      description: "Kanban boards, smart reminders, and team collaboration tools",
      highlights: ["Kanban Boards", "Due Date Alerts", "Assignment", "Activity Log"]
    },
    {
      icon: Shield,
      title: "Access Control & Security",
      description: "Role-based permissions, audit logs, and enterprise-grade security",
      highlights: ["Custom Roles", "Audit Trail", "Data Encryption", "User Management"]
    },
    {
      icon: Target,
      title: "Duplicate Management",
      description: "AI-powered duplicate detection and intelligent merge capabilities",
      highlights: ["Smart Detection", "Merge Suggestions", "Bulk Actions", "Conflict Resolution"]
    },
    {
      icon: Award,
      title: "Playbooks & Best Practices",
      description: "Document workflows, procedures, and maintain institutional knowledge",
      highlights: ["Process Documentation", "Templates", "Training Materials", "Searchable Library"]
    }
  ];

  const stats = [
    { label: "Active Users", value: "500+", icon: Users },
    { label: "Candidates Managed", value: "50K+", icon: Users },
    { label: "Jobs Filled", value: "10K+", icon: Briefcase },
    { label: "Time Saved", value: "70%", icon: Clock }
  ];

  const testimonials = [
    {
      name: "Sarah Johnson",
      role: "Recruiting Director",
      company: "TechCorp",
      quote: "Recruiter X transformed our hiring process. The AI matching saves us hours daily, and the automation features have doubled our placement rate.",
      rating: 5
    },
    {
      name: "Michael Chen",
      role: "VP of Talent",
      company: "Global Solutions",
      quote: "Best recruitment platform we've used. The analytics give us insights we never had before, and the candidate experience has improved dramatically.",
      rating: 5
    },
    {
      name: "Emily Rodriguez",
      role: "Talent Acquisition Lead",
      company: "Innovation Labs",
      quote: "The AI features are game-changing. From resume parsing to interview assistance, everything is automated yet personalized. Highly recommend!",
      rating: 5
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/291ea5029_TalentStackCorporateImages-1.png"
                alt="Recruiter X"
                className="w-10 h-10 rounded-xl object-contain"
              />
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Recruiter X</h1>
                <p className="text-xs text-slate-600">AI-Powered Recruitment Platform</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={handleLogin}
                className="gap-2"
              >
                Sign In
                <ArrowRight className="w-4 h-4" />
              </Button>
              <Button
                onClick={() => setShowTrialForm(true)}
                className="gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
              >
                <Sparkles className="w-4 h-4" />
                Request Trial Access
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-purple-600/10 to-cyan-600/10" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzAwMDAwMCIgc3Ryb2tlLW9wYWNpdHk9IjAuMDUiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-30" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Badge className="mb-6 text-sm px-4 py-2 bg-blue-100 text-blue-800 border-blue-300">
            <Sparkles className="w-3 h-3 mr-1" />
            Powered by Advanced AI
          </Badge>
          
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-slate-900 mb-6">
            The Future of
            <br />
            <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-cyan-600 bg-clip-text text-transparent">
              Recruitment Intelligence
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-slate-600 mb-8 max-w-3xl mx-auto">
            AI-powered platform that automates your entire recruitment workflow, 
            from candidate sourcing to placement, saving you 70% of manual work.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Button
              size="lg"
              onClick={() => setShowTrialForm(true)}
              className="text-lg px-8 py-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-xl hover:shadow-2xl transition-all"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Start Free Trial
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })}
              className="text-lg px-8 py-6"
            >
              Explore Features
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
            {stats.map((stat, index) => (
              <Card key={index} className="border-2">
                <CardContent className="p-6 text-center">
                  <stat.icon className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                  <div className="text-3xl font-bold text-slate-900 mb-1">{stat.value}</div>
                  <div className="text-sm text-slate-600">{stat.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge className="mb-4 text-sm px-4 py-2">
              Complete Platform
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Everything You Need to Excel
            </h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              Comprehensive features designed to streamline every aspect of your recruitment process
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="hover:shadow-xl transition-all duration-300 border-2 hover:border-blue-300">
                <CardHeader>
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600 mb-4">{feature.description}</p>
                  <div className="space-y-2">
                    {feature.highlights.map((highlight, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm text-slate-700">
                        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                        <span>{highlight}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* AI Features Highlight */}
      <section className="py-20 bg-gradient-to-br from-blue-600 to-purple-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge className="mb-4 text-sm px-4 py-2 bg-white/20">
              <Brain className="w-3 h-3 mr-1" />
              AI-Powered
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Intelligence That Works For You
            </h2>
            <p className="text-xl text-blue-100 max-w-3xl mx-auto">
              Our AI doesn't just automate tasks—it thinks, learns, and improves your entire recruitment strategy
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="bg-white/10 backdrop-blur-lg border-white/20">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Search className="w-6 h-6" />
                  AI Candidate Screening
                </CardTitle>
              </CardHeader>
              <CardContent className="text-white/90 space-y-3">
                <p>Automatically screen candidates against job requirements with 95%+ accuracy</p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <span>Resume parsing and skill extraction</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <span>Match scoring with detailed analysis</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <span>Automatic ranking and recommendations</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-white/10 backdrop-blur-lg border-white/20">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <MessageSquare className="w-6 h-6" />
                  Smart Outreach Campaigns
                </CardTitle>
              </CardHeader>
              <CardContent className="text-white/90 space-y-3">
                <p>AI-generated personalized messages that improve response rates by 3x</p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <span>Context-aware message generation</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <span>Multi-channel automation (Email, SMS, LinkedIn)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <span>Response tracking and sentiment analysis</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-white/10 backdrop-blur-lg border-white/20">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Target className="w-6 h-6" />
                  Intelligent Matching
                </CardTitle>
              </CardHeader>
              <CardContent className="text-white/90 space-y-3">
                <p>Advanced algorithms match candidates to jobs based on skills, experience, and culture fit</p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <span>Semantic skill matching (React → ReactJS)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <span>Technology domain intelligence</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <span>Experience level and role alignment</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-white/10 backdrop-blur-lg border-white/20">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Zap className="w-6 h-6" />
                  Workflow Automation
                </CardTitle>
              </CardHeader>
              <CardContent className="text-white/90 space-y-3">
                <p>AI agent proactively identifies actions needed and automates follow-ups</p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <span>Auto status updates based on pipeline stage</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <span>Follow-up reminders and task creation</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <span>Critical alerts for time-sensitive actions</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge className="mb-4 text-sm px-4 py-2">
              <Award className="w-3 h-3 mr-1" />
              Trusted by Leaders
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              What Our Clients Say
            </h2>
            <p className="text-xl text-slate-600">
              Join hundreds of companies that have transformed their recruitment
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="hover:shadow-xl transition-all">
                <CardContent className="p-6">
                  <div className="flex items-center gap-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-slate-700 mb-6 italic">"{testimonial.quote}"</p>
                  <div className="border-t pt-4">
                    <p className="font-semibold text-slate-900">{testimonial.name}</p>
                    <p className="text-sm text-slate-600">{testimonial.role}</p>
                    <p className="text-sm text-blue-600">{testimonial.company}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Ready to Transform Your Recruitment?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join industry leaders and start your free trial today. No credit card required.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="lg"
              onClick={() => setShowTrialForm(true)}
              className="text-lg px-8 py-6 bg-white text-blue-600 hover:bg-blue-50"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Request Trial Access
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={handleLogin}
              className="text-lg px-8 py-6 border-2 border-white text-white hover:bg-white/10"
            >
              Sign In
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <img
                  src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/291ea5029_TalentStackCorporateImages-1.png"
                  alt="Recruiter X"
                  className="w-8 h-8 rounded-lg"
                />
                <span className="text-white font-bold text-lg">Recruiter X</span>
              </div>
              <p className="text-sm">
                AI-powered recruitment platform transforming how companies hire top talent.
              </p>
            </div>
            
            <div>
              <h3 className="text-white font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Integrations</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-white font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-white font-semibold mb-4">Legal</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Privacy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Security</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row items-center justify-between">
            <p className="text-sm">
              © {new Date().getFullYear()} Recruiter X. All rights reserved.
            </p>
            <div className="flex items-center gap-4 mt-4 md:mt-0">
              <a href="mailto:support@recruiterx.com" className="flex items-center gap-2 text-sm hover:text-white transition-colors">
                <Mail className="w-4 h-4" />
                support@recruiterx.com
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Trial Request Modal */}
      {showTrialForm && (
        <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4" onClick={() => setShowTrialForm(false)}>
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="flex flex-row items-center justify-between border-b">
              <div>
                <CardTitle className="text-2xl">Request Trial Access</CardTitle>
                <p className="text-sm text-slate-600 mt-2">
                  Fill out the form below and we'll get back to you within 24 hours
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowTrialForm(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </Button>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleTrialRequest} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">
                      Company Name *
                    </label>
                    <Input
                      required
                      value={formData.company_name}
                      onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                      placeholder="Acme Corp"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">
                      Full Name *
                    </label>
                    <Input
                      required
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      placeholder="John Doe"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">
                      Work Email *
                    </label>
                    <Input
                      required
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="john@company.com"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">
                      Phone Number
                    </label>
                    <Input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">
                    Company Size *
                  </label>
                  <select
                    required
                    value={formData.company_size}
                    onChange={(e) => setFormData({ ...formData, company_size: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select company size</option>
                    <option value="1-10">1-10 employees</option>
                    <option value="11-50">11-50 employees</option>
                    <option value="51-200">51-200 employees</option>
                    <option value="201-500">201-500 employees</option>
                    <option value="500+">500+ employees</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">
                    Tell us about your recruitment needs
                  </label>
                  <Textarea
                    rows={4}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="What are your biggest recruitment challenges? How many hires do you make per month?"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowTrialForm(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Request Trial
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}