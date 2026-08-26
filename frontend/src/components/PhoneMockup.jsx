import { BatteryCharging, Camera, MessageCircle, Phone, Wifi } from "lucide-react";

export default function PhoneMockup({ connected = true, compact = false }) {
  return (
    <div className={`phone-wrap ${compact ? "phone-compact" : ""}`}>
      <div className="phone-glow" />
      <div className="phone-frame">
        <div className="phone-speaker" />
        <div className="phone-screen">
          <div className="phone-statusbar">
            <span>10:42</span>
            <span className="status-icons"><Wifi size={12} /><BatteryCharging size={14} /></span>
          </div>
          <div className="phone-wallpaper">
            <div className="wall-orb wall-orb-one" />
            <div className="wall-orb wall-orb-two" />
            <div className="phone-date">Sunday</div>
            <div className="phone-time">10:42</div>
            <div className="phone-weather">28° · Clear</div>
            <div className="phone-app-grid">
              <span><Phone size={18} /></span>
              <span><MessageCircle size={18} /></span>
              <span><Camera size={18} /></span>
              <span><span className="mini-app-dot" /></span>
            </div>
          </div>
          {connected && (
            <div className="phone-session-pill">
              <i /> Remote support active
            </div>
          )}
          <div className="phone-homebar" />
        </div>
      </div>
    </div>
  );
}
