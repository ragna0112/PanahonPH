import {
  ArrowUpRight,
  CloudSun,
  Cloud,
  Droplets,
  Wind,
  Thermometer,
  MapPin,
  Search,
  Star,
  Clock3,
  Radio,
  Code2,
  Sun,
  CalendarDays,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

function EmptyMetric({
  icon: Icon,
  label,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  detail: string;
}) {
  return (
    <div className="metric">
      <Icon size={20} aria-hidden="true" />
      <p>{label}</p>
      <strong>—</strong>
      <span>{detail}</span>
    </div>
  );
}

function App() {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <a href="#" className="brand" aria-label="PanahonPH home">
          <span className="brand-mark">
            <CloudSun size={27} />
          </span>
          <span>
            Panahon<span className="brand-ph">PH</span>
            <small>YOUR LOCAL SKY, AT A GLANCE</small>
          </span>
        </a>
        <nav aria-label="Main navigation">
          <a className="nav-active" href="#main">
            Overview
          </a>
          <a href="#project">
            About the project <ArrowUpRight size={14} />
          </a>
        </nav>
        <span className="country">
          <span /> Philippines
        </span>
      </header>
      <main id="main">
        <div className="intro">
          <div>
            <p className="eyebrow">A LITTLE CLARITY, RAIN OR SHINE</p>
            <h1>Your day starts with the sky.</h1>
            <p className="subtle">
              Weather across the Philippines, all in one place.
            </p>
          </div>
          <div className="timezone">
            <Clock3 size={16} /> Philippine Standard Time
            <span>Asia/Manila · UTC+08:00</span>
          </div>
        </div>
        <div className="search-row">
          <div className="search-box">
            <Search size={20} aria-hidden="true" />
            <input
              aria-label="Search Philippine locations (available in milestone 3)"
              placeholder="Search a Philippine city or municipality"
              disabled
            />
            <kbd>Coming soon</kbd>
          </div>
          <span className="unit">
            °C <span>/</span> Metric units
          </span>
        </div>
        <div className="dashboard-grid">
          <section className="current-card" aria-labelledby="current-title">
            <div className="card-top">
              <span className="location">
                <MapPin size={18} /> Manila{" "}
                <small>Metro Manila, Philippines</small>
              </span>
              <span className="outline-badge">PREVIEW</span>
            </div>
            <div className="current-body">
              <div>
                <p className="eyebrow" id="current-title">
                  CURRENT WEATHER
                </p>
                <h2>
                  Waiting for
                  <br />a sky update.
                </h2>
                <p>Weather data not connected yet</p>
                <span className="connection">
                  <span /> Live connection arrives in milestone 2
                </span>
              </div>
              <div className="weather-art" aria-hidden="true">
                <div className="sun-disc" />
                <Cloud className="hero-cloud" strokeWidth={1} />
              </div>
            </div>
            <div className="current-footer">
              <Radio size={15} />
              <span>No weather readings have been fetched.</span>
              <span className="temperature-unit">CELSIUS °C</span>
            </div>
          </section>
          <aside className="favorites-card">
            <div className="section-heading">
              <h2>
                <Star size={18} /> Your places
              </h2>
              <span className="tiny-badge">MILESTONE 5</span>
            </div>
            <div className="favorites-empty">
              <span className="icon-tile">
                <MapPin size={25} />
              </span>
              <h3>A home for your favorite skies.</h3>
              <p>
                Save the places you care about
                <br />
                and check back in a heartbeat.
              </p>
              <button disabled>
                <Star size={15} /> Saved locations coming soon
              </button>
            </div>
          </aside>
          <section
            className="conditions-card"
            aria-labelledby="conditions-title"
          >
            <div className="section-heading">
              <h2 id="conditions-title">The details</h2>
              <span>Current conditions</span>
            </div>
            <div className="metrics-grid">
              <EmptyMetric
                icon={Thermometer}
                label="Feels like"
                detail="Degrees Celsius"
              />
              <EmptyMetric
                icon={Droplets}
                label="Humidity"
                detail="Relative humidity · %"
              />
              <EmptyMetric
                icon={Wind}
                label="Wind speed"
                detail="Kilometers per hour"
              />
              <EmptyMetric
                icon={CloudSun}
                label="Conditions"
                detail="Awaiting weather data"
              />
            </div>
          </section>
          <section className="forecast-card" aria-labelledby="forecast-title">
            <div className="section-heading">
              <h2 id="forecast-title">
                <CalendarDays size={18} /> Looking ahead
              </h2>
              <span className="tiny-badge">MILESTONE 4</span>
            </div>
            <div className="forecast-empty">
              <span className="forecast-icon">
                <Sun size={24} />
                <span>···</span>
                <Cloud size={24} />
              </span>
              <h3>A forecast worth planning around.</h3>
              <p>
                Hourly temperature, chance of rain, and a seven-day outlook will
                appear here once connected.
              </p>
              <span className="forecast-note">
                No forecast data available yet
              </span>
            </div>
          </section>
        </div>
        <section id="project" className="project-note">
          <span className="note-icon">
            <CloudSun size={21} />
          </span>
          <div>
            <h2>Good things are on the horizon.</h2>
            <p>
              You're viewing the foundation of PanahonPH. Live weather, local
              search, and forecasts are up next.
            </p>
          </div>
          <span className="progress-badge">
            01 <span>/ 07 milestones</span>
          </span>
        </section>
      </main>
      <footer>
        <span>
          PanahonPH <span className="footer-dot">·</span> Made for the
          Philippine skies.
        </span>
        <div>
          <span>
            Planned data source:{" "}
            <a href="https://open-meteo.com/">
              Open-Meteo <ArrowUpRight size={12} />
            </a>
          </span>
          <a href="https://github.com/ragna0112/PanahonPH">
            <Code2 size={15} /> Source code
          </a>
        </div>
        <p>Portfolio project · Not an official PAGASA warning service.</p>
      </footer>
    </div>
  );
}

export default App;
