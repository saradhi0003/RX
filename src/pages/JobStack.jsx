import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Briefcase,
  MapPin,
  DollarSign,
  Calendar,
  Building2,
  ExternalLink,
  Filter
} from "lucide-react";
import { Job } from "@/entities/Job";
import { Company } from "@/entities/Company";

export default function JobStackPublic() {
  const [jobs, setJobs] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadJobs = async () => {
      try {
        // Fetch all open jobs from the main Job entity
        // This should work without authentication if the app is set to public
        const [jobsData, companiesData] = await Promise.all([
          Job.filter({ status: "open" }, "-created_date").catch(() => []),
          Company.list().catch(() => [])
        ]);
        setJobs(jobsData || []);
        setCompanies(companiesData || []);
        setError(null);
      } catch (error) {
        console.error("Error loading job stack:", error);
        setError("Unable to load jobs. Please try again later.");
        setJobs([]);
        setCompanies([]);
      }
      setLoading(false);
    };
    loadJobs();
  }, []);

  const getCompanyName = (companyId) => {
    const company = companies.find(c => c.id === companyId);
    return company?.name || "Company";
  };

  const getCompanyIndustry = (companyId) => {
    const company = companies.find(c => c.id === companyId);
    return company?.industry || "";
  };

  const filteredJobs = jobs.filter(job => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const companyName = getCompanyName(job.company_id).toLowerCase();
    const companyIndustry = getCompanyIndustry(job.company_id).toLowerCase();
    return (
      job.title?.toLowerCase().includes(term) ||
      companyName.includes(term) ||
      job.location?.toLowerCase().includes(term) ||
      job.description?.toLowerCase().includes(term) ||
      companyIndustry.includes(term) ||
      job.required_skills?.some(skill => skill.toLowerCase().includes(term))
    );
  });

  const getEmploymentTypeBadge = (type) => {
    const colors = {
      full_time: "bg-blue-100 text-blue-800",
      part_time: "bg-purple-100 text-purple-800",
      contract: "bg-orange-100 text-orange-800",
      contract_to_hire: "bg-green-100 text-green-800"
    };
    return colors[type] || colors.contract;
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: "bg-slate-100 text-slate-800",
      medium: "bg-blue-100 text-blue-800",
      high: "bg-orange-100 text-orange-800",
      urgent: "bg-red-100 text-red-800"
    };
    return colors[priority] || colors.medium;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/291ea5029_TalentStackCorporateImages-1.png"
                alt="Talent Stack"
                className="w-10 h-10 rounded-xl object-contain"
              />
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Job Stack</h1>
                <p className="text-sm text-slate-600">Open Opportunities</p>
              </div>
            </div>
            <Badge className="bg-green-100 text-green-800 text-sm">
              {filteredJobs.length} Open {filteredJobs.length === 1 ? 'Position' : 'Positions'}
            </Badge>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Search Bar */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                placeholder="Search by title, company, location, skills, or industry..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-12 text-base"
              />
            </div>
          </CardContent>
        </Card>

        {/* Error State */}
        {error && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="p-6 text-center">
              <p className="text-red-600">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="space-y-3">
                    <div className="h-5 bg-slate-200 rounded w-2/3"></div>
                    <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                    <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredJobs.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Briefcase className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">
                {searchTerm ? "No matching jobs found" : "No open positions available"}
              </h3>
              <p className="text-slate-600">
                {searchTerm ? "Try adjusting your search criteria" : "Check back soon for new opportunities"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredJobs.map((job) => (
              <Card key={job.id} className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-green-500">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {/* Title and Company */}
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                      <div className="flex-1">
                        <h2 className="text-xl font-bold text-slate-900 mb-1">
                          {job.title}
                        </h2>
                        <div className="flex flex-wrap items-center gap-2 text-slate-600 mb-3">
                          <div className="flex items-center gap-1">
                            <Building2 className="w-4 h-4" />
                            <span className="font-medium">{getCompanyName(job.company_id)}</span>
                          </div>
                          {getCompanyIndustry(job.company_id) && (
                            <>
                              <span className="text-slate-400">•</span>
                              <span className="text-sm">{getCompanyIndustry(job.company_id)}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Badges */}
                      <div className="flex flex-wrap gap-2">
                        <Badge className="bg-green-100 text-green-800">
                          Open
                        </Badge>
                        {job.employment_type && (
                          <Badge className={getEmploymentTypeBadge(job.employment_type)}>
                            {job.employment_type.replace('_', ' ')}
                          </Badge>
                        )}
                        {job.priority && (
                          <Badge className={getPriorityColor(job.priority)}>
                            {job.priority}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Job Details */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                      {job.location && (
                        <div className="flex items-center gap-2 text-slate-700">
                          <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <span>{job.location}</span>
                        </div>
                      )}

                      {job.rate && (
                        <div className="flex items-center gap-2 text-slate-700">
                          <DollarSign className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <span>{job.rate}</span>
                        </div>
                      )}
                      
                      {job.due_date && (
                        <div className="flex items-center gap-2 text-slate-700">
                          <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <span>Apply by: {new Date(job.due_date).toLocaleDateString()}</span>
                        </div>
                      )}

                      {job.experience_required && (
                        <div className="flex items-center gap-2 text-slate-700">
                          <Briefcase className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <span>{job.experience_required} years exp</span>
                        </div>
                      )}
                    </div>

                    {/* Description */}
                    {job.description && (
                      <div className="text-sm text-slate-600 border-t pt-3">
                        <p className="line-clamp-2">{job.description}</p>
                      </div>
                    )}

                    {/* Required Skills */}
                    {job.required_skills && job.required_skills.length > 0 && (
                      <div className="border-t pt-3">
                        <p className="text-xs font-medium text-slate-500 mb-2">Required Skills:</p>
                        <div className="flex flex-wrap gap-2">
                          {job.required_skills.slice(0, 10).map((skill, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                              {skill}
                            </Badge>
                          ))}
                          {job.required_skills.length > 10 && (
                            <Badge variant="outline" className="text-xs bg-slate-50">
                              +{job.required_skills.length - 10} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Action Button */}
                    <div className="border-t pt-4">
                      <Button 
                        className="w-full md:w-auto bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => {
                          // For now, just show alert. In production, this would link to application form
                          alert(`To apply for this position, please contact us at:\n\nEmail: careers@talentstack.com\nJob Title: ${job.title}\nJob ID: ${job.id}`);
                        }}
                      >
                        Apply Now
                        <ExternalLink className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-white border-t mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="text-center text-sm text-slate-600">
            <p className="mb-2">© {new Date().getFullYear()} Talent Stack. All rights reserved.</p>
            <p className="text-xs text-slate-500">
              For inquiries, contact us at <a href="mailto:careers@talentstack.com" className="text-blue-600 hover:underline">careers@talentstack.com</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}