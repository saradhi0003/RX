import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Mail, Phone, MapPin, Linkedin, Twitter, Facebook } from "lucide-react";

export default function PublicFooter() {
  return (
    <footer className="bg-slate-900 text-slate-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Company Info */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <img
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/291ea5029_TalentStackCorporateImages-1.png"
                alt="Talent Stack"
                className="w-10 h-10 rounded-xl object-contain"
              />
              <span className="text-xl font-bold text-white">TalentStack</span>
            </div>
            <p className="text-sm text-slate-400 mb-4">
              Empowering staffing agencies with AI-powered recruitment solutions.
            </p>
            <div className="flex items-center gap-4">
              <a href="#" className="hover:text-blue-400 transition-colors">
                <Linkedin className="w-5 h-5" />
              </a>
              <a href="#" className="hover:text-blue-400 transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="#" className="hover:text-blue-400 transition-colors">
                <Facebook className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link to={createPageUrl("Landing")} className="text-sm hover:text-blue-400 transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link to={createPageUrl("Services")} className="text-sm hover:text-blue-400 transition-colors">
                  Services
                </Link>
              </li>
              <li>
                <Link to={createPageUrl("Products")} className="text-sm hover:text-blue-400 transition-colors">
                  Products
                </Link>
              </li>
              <li>
                <Link to={createPageUrl("Careers")} className="text-sm hover:text-blue-400 transition-colors">
                  Careers
                </Link>
              </li>
              <li>
                <Link to={createPageUrl("Blog")} className="text-sm hover:text-blue-400 transition-colors">
                  Blog
                </Link>
              </li>
            </ul>
          </div>

          {/* Services */}
          <div>
            <h3 className="text-white font-semibold mb-4">Solutions</h3>
            <ul className="space-y-2">
              <li>
                <a href="#" className="text-sm hover:text-blue-400 transition-colors">
                  AI Candidate Matching
                </a>
              </li>
              <li>
                <a href="#" className="text-sm hover:text-blue-400 transition-colors">
                  Resume Analysis
                </a>
              </li>
              <li>
                <a href="#" className="text-sm hover:text-blue-400 transition-colors">
                  Interview Assistant
                </a>
              </li>
              <li>
                <a href="#" className="text-sm hover:text-blue-400 transition-colors">
                  Pipeline Analytics
                </a>
              </li>
              <li>
                <a href="#" className="text-sm hover:text-blue-400 transition-colors">
                  Automation Tools
                </a>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="text-white font-semibold mb-4">Contact Us</h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-2">
                <Mail className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                <a href="mailto:info@talentstack.com" className="text-sm hover:text-blue-400 transition-colors">
                  info@talentstack.com
                </a>
              </li>
              <li className="flex items-start gap-2">
                <Phone className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                <a href="tel:+1234567890" className="text-sm hover:text-blue-400 transition-colors">
                  +1 (234) 567-890
                </a>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                <span className="text-sm">
                  123 Business Ave,<br />
                  Suite 100, City, ST 12345
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800 mt-8 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-slate-400">
              © {new Date().getFullYear()} TalentStack. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <Link to="#" className="text-sm text-slate-400 hover:text-blue-400 transition-colors">
                Privacy Policy
              </Link>
              <Link to="#" className="text-sm text-slate-400 hover:text-blue-400 transition-colors">
                Terms of Service
              </Link>
              <Link to="#" className="text-sm text-slate-400 hover:text-blue-400 transition-colors">
                Cookie Policy
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}