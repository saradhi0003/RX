import { useState, useEffect } from "react";
import { Candidate } from "@/entities/Candidate";
import CandidatePreview from "@/components/candidates/CandidatePreview";
import { Loader2, AlertCircle } from "lucide-react";

export default function CandidatePreviewLoader({ id }) {
  const [candidate, setCandidate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    const loadCandidate = async () => {
      if (!id) {
        setError("No candidate ID provided");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const data = await Candidate.get(id);
        
        if (!mounted) return;
        
        if (!data) {
          setError("Candidate not found");
        } else {
          setCandidate(data);
        }
      } catch (err) {
        console.error("Error loading candidate:", err);
        if (mounted) {
          setError(err.message || "Failed to load candidate");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadCandidate();

    return () => {
      mounted = false;
    };
  }, [id]);

  const handleUpdated = () => {
    // Reload candidate data after update
    setLoading(true);
    Candidate.get(id)
      .then(data => {
        setCandidate(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error reloading candidate:", err);
        setError(err.message || "Failed to reload candidate");
        setLoading(false);
      });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
          <p className="text-sm text-slate-600">Loading candidate...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm text-slate-600">Candidate not found</p>
        </div>
      </div>
    );
  }

  return (
    <CandidatePreview 
      candidate={candidate} 
      onUpdated={handleUpdated}
    />
  );
}