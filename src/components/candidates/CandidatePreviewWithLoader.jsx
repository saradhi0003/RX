import { useEffect, useState } from "react";
import { Candidate } from "@/entities/Candidate";
import CandidatePreview from "./CandidatePreview";

export default function CandidatePreviewWithLoader({ id, onEdit, onUpdated }) {
  const [candidate, setCandidate] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    const loadCandidate = async () => {
      try {
        const c = await Candidate.get(id);
        setCandidate(c);
      } catch (e) {
        console.error("Error loading candidate:", e);
        setCandidate(null);
      } finally {
        setLoading(false);
      }
    };

    loadCandidate();
  }, [id]);

  if (loading) {
    return <div className="text-center py-8 text-slate-500">Loading candidate...</div>;
  }

  if (!candidate) {
    return <div className="text-center py-8 text-slate-500">Candidate not found.</div>;
  }

  return <CandidatePreview candidate={candidate} onEdit={onEdit} onUpdated={onUpdated} />;
}