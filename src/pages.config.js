import AIAgents from './pages/AIAgents';
import AccessControl from './pages/AccessControl';
import Approvals from './pages/Approvals';
import AutomationRules from './pages/AutomationRules';
import BRD from './pages/BRD';
import Blog from './pages/Blog';
import CandidateDetails from './pages/CandidateDetails';
import Candidates from './pages/Candidates';
import Careers from './pages/Careers';
import Companies from './pages/Companies';
import CompanyDetails from './pages/CompanyDetails';
import Consultants from './pages/Consultants';
import Contact from './pages/Contact';
import Dashboard from './pages/Dashboard';
import DuplicateManager from './pages/DuplicateManager';
import EmailBlast from './pages/EmailBlast';
import EmailInbox from './pages/EmailInbox';
import EmailSettings from './pages/EmailSettings';
import EmailTemplateBuilder from './pages/EmailTemplateBuilder';
import Expenses from './pages/Expenses';
import Home from './pages/Home';
import Invoices from './pages/Invoices';
import JobDetails from './pages/JobDetails';
import JobStack from './pages/JobStack';
import Jobs from './pages/Jobs';
import Landing from './pages/Landing';
import Mobile from './pages/Mobile';
import MyWork from './pages/MyWork';
import PipelineAnalytics from './pages/PipelineAnalytics';
import PlaybookDetails from './pages/PlaybookDetails';
import Playbooks from './pages/Playbooks';
import Products from './pages/Products';
import Recruiters from './pages/Recruiters';
import ResumeAnalysis from './pages/ResumeAnalysis';
import ResumeBuilder from './pages/ResumeBuilder';
import ResumeStudio from './pages/ResumeStudio';
import Services from './pages/Services';
import SkillMatrix from './pages/SkillMatrix';
import Submissions from './pages/Submissions';
import TaskDetails from './pages/TaskDetails';
import Tasks from './pages/Tasks';
import Goals from './pages/Goals';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AIAgents": AIAgents,
    "AccessControl": AccessControl,
    "Approvals": Approvals,
    "AutomationRules": AutomationRules,
    "BRD": BRD,
    "Blog": Blog,
    "CandidateDetails": CandidateDetails,
    "Candidates": Candidates,
    "Careers": Careers,
    "Companies": Companies,
    "CompanyDetails": CompanyDetails,
    "Consultants": Consultants,
    "Contact": Contact,
    "Dashboard": Dashboard,
    "DuplicateManager": DuplicateManager,
    "EmailBlast": EmailBlast,
    "EmailInbox": EmailInbox,
    "EmailSettings": EmailSettings,
    "EmailTemplateBuilder": EmailTemplateBuilder,
    "Expenses": Expenses,
    "Home": Home,
    "Invoices": Invoices,
    "JobDetails": JobDetails,
    "JobStack": JobStack,
    "Jobs": Jobs,
    "Landing": Landing,
    "Mobile": Mobile,
    "MyWork": MyWork,
    "PipelineAnalytics": PipelineAnalytics,
    "PlaybookDetails": PlaybookDetails,
    "Playbooks": Playbooks,
    "Products": Products,
    "Recruiters": Recruiters,
    "ResumeAnalysis": ResumeAnalysis,
    "ResumeBuilder": ResumeBuilder,
    "ResumeStudio": ResumeStudio,
    "Services": Services,
    "SkillMatrix": SkillMatrix,
    "Submissions": Submissions,
    "TaskDetails": TaskDetails,
    "Tasks": Tasks,
    "Goals": Goals,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};