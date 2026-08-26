import { RadioTower } from "lucide-react";
import { Link } from "react-router-dom";

export default function Brand({ compact = false }) {
  return (
    <Link to="/" className={`brand ${compact ? "brand-compact" : ""}`} aria-label="AirLink home">
      <span className="brand-mark"><RadioTower size={20} /></span>
      <span>Air<span>Link</span></span>
    </Link>
  );
}
