import { useAuth } from "@/lib/AuthContext";
import AIRecruiterDashboard from "@/components/ai-recruiter/AIRecruiterDashboard";

export default function AIRecruiter() {
  const { user } = useAuth();
  return <AIRecruiterDashboard user={user} />;
}
