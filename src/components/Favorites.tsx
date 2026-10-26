import { useRef, useState } from "react";
import { MapPin, Star, Trash2 } from "lucide-react";
import { locationDetails } from "../services/locations";
import type { WeatherLocation } from "../services/locations";
import { useFavorites } from "../hooks/useFavorites";
export default function Favorites({
  location,
  onSelect,
}: {
  location: WeatherLocation;
  onSelect: (place: WeatherLocation) => void;
}) {
  const favorites = useFavorites();
  const [announcement, setAnnouncement] = useState("");
  const saveButton = useRef<HTMLButtonElement>(null);
  const saved = favorites.locations.some((place) => place.id === location.id);
  return (
    <aside className="favorites-card" aria-labelledby="favorites-title">
      <div className="section-heading">
        <h2 id="favorites-title">
          <Star size={18} aria-hidden="true" /> Your places
        </h2>
        <span>{favorites.locations.length} saved</span>
      </div>
      <button
        ref={saveButton}
        className="save-location"
        onClick={() => {
          if (saved) favorites.remove(location.id);
          else favorites.save(location);
          setAnnouncement(
            `${location.name} ${saved ? "removed from" : "added to"} favorites.`,
          );
        }}
        aria-label={`Save ${location.name} to favorites`}
        aria-pressed={saved}
        aria-describedby="favorite-toggle-help"
      >
        <Star size={15} aria-hidden="true" />
        <span>Save {location.name} to favorites</span>
      </button>
      <p id="favorite-toggle-help" className="favorite-help">
        {saved
          ? "Saved. Press again to remove."
          : "Save this place for quick access."}
      </p>
      <p className="sr-only" role="status" aria-atomic="true">
        {announcement}
      </p>
      {favorites.warning && (
        <p className="storage-warning" role="status">
          {favorites.warning}
        </p>
      )}
      {!favorites.locations.length ? (
        <div className="favorites-empty">
          <span className="icon-tile">
            <MapPin size={25} aria-hidden="true" />
          </span>
          <h3>A home for your favorite skies.</h3>
          <p>
            Save this location, or search for another Philippine place to add.
          </p>
        </div>
      ) : (
        <ul className="favorites-list">
          {favorites.locations.map((place) => (
            <li key={place.id}>
              <button
                aria-label={`Select ${place.name}, ${locationDetails(place)}${place.id === location.id ? " · Selected" : ""}`}
                className="favorite-select"
                onClick={() => onSelect(place)}
                aria-current={place.id === location.id ? "location" : undefined}
              >
                <strong>{place.name}</strong>{" "}
                <small>{locationDetails(place)}</small>
              </button>
              <button
                className="favorite-remove"
                aria-label={`Remove ${place.name}, ${locationDetails(place)} from favorites`}
                onClick={() => {
                  favorites.remove(place.id);
                  setAnnouncement(`${place.name} removed from favorites.`);
                  saveButton.current?.focus();
                }}
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="favorites-note">Saved only in this browser.</p>
    </aside>
  );
}
