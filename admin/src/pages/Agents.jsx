import { useCallback, useEffect, useMemo, useState } from 'react';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import { agentStatusStyles } from '../data/agentsData';
import { fetchAgentProfile, fetchAgents } from '../services/agents';
import './Agents.css';

const profileFields = [
  { label: 'Name', key: 'name' },
  { label: 'ID', key: 'id' },
  { label: 'Phone', key: 'phone' },
  { label: 'Email', key: 'email' },
  { label: 'Date of birth', key: 'dateOfBirth' },
  { label: 'Nationality', key: 'nationality' },
  { label: 'City', key: 'city' },
  { label: 'State', key: 'state' },
  { label: 'Vehicle type', key: 'vehicleType' },
  { label: 'Vehicle model', key: 'vehicleModel' },
  { label: 'Vehicle color', key: 'vehicleColor' },
  { label: 'License plate', key: 'licensePlate' },
];

function formatEarned(amount) {
  return `₹${amount.toLocaleString('en-IN')}`;
}

function Agents() {
  const [agents, setAgents] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileAgent, setProfileAgent] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileNotice, setProfileNotice] = useState('');

  const loadAgents = useCallback(async () => {
    try {
      setError('');
      const data = await fetchAgents();
      setAgents(data);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          'Failed to load agents. Make sure the backend is running.',
      );
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function init() {
      setLoading(true);
      try {
        const data = await fetchAgents();
        if (active) setAgents(data);
      } catch (err) {
        if (active) {
          setError(
            err.response?.data?.message ||
              err.message ||
              'Failed to load agents. Make sure the backend is running.',
          );
          setAgents([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    init();
    const intervalId = window.setInterval(() => {
      if (active) loadAgents();
    }, 10000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [loadAgents]);

  const filteredAgents = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return agents;

    return agents.filter((agent) => {
      const haystack = [
        agent.name,
        agent.city,
        agent.status,
        agent.vehicle,
        agent.bookingId,
        String(agent.id ?? ''),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [agents, search]);

  const closeProfile = () => {
    setProfileOpen(false);
    setProfileAgent(null);
    setProfileData(null);
    setProfileError('');
    setProfileNotice('');
    setProfileLoading(false);
  };

  const openProfile = async (agent) => {
    setProfileAgent(agent);
    setProfileOpen(true);
    setProfileData(null);
    setProfileError('');
    setProfileNotice('');
    setProfileLoading(true);

    try {
      const result = await fetchAgentProfile(agent.id);
      setProfileData(result.profile || null);
      setProfileNotice(result.message || '');
    } catch (err) {
      setProfileError(
        err.response?.data?.message || err.message || 'Failed to load agent profile.',
      );
    } finally {
      setProfileLoading(false);
    }
  };

  return (
    <div className="agents-page">
      <div className="agents-page__header">
        <div className="agents-page__intro">
          <h2>Agents</h2>
          <p>
            {loading
              ? 'Loading agents...'
              : `${agents.length} registered delivery agent${agents.length === 1 ? '' : 's'}`}
          </p>
        </div>

        <div className="agents-page__search">
          <span className="agents-page__search-icon" aria-hidden="true">
            <SearchOutlinedIcon />
          </span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search agents..."
            aria-label="Search agents"
            disabled={loading}
          />
        </div>
      </div>

      {error ? <p className="agents-page__error">{error}</p> : null}

      {loading ? (
        <p className="agents-page__empty">Loading agents...</p>
      ) : filteredAgents.length === 0 ? (
        <p className="agents-page__empty">
          {agents.length === 0 ? 'No agents registered yet.' : 'No agents match your search.'}
        </p>
      ) : (
        <div className="agents-grid">
          {filteredAgents.map((agent) => {
            const statusStyle = agentStatusStyles[agent.status] || agentStatusStyles.Offline;

            return (
              <article key={agent.id} className="agent-card">
                <div className="agent-card__top">
                  <div className="agent-card__profile">
                    <div className="agent-card__avatar-wrap">
                      <span
                        className="agent-card__avatar"
                        style={{ background: agent.color }}
                        aria-hidden="true"
                      >
                        {agent.initials}
                      </span>
                      <span
                        className="agent-card__status-dot"
                        style={{ background: statusStyle.dot }}
                        aria-hidden="true"
                      />
                    </div>
                    <div className="agent-card__info">
                      <h3 className="agent-card__name">{agent.name}</h3>
                      <span className="agent-card__city">
                        <LocationOnOutlinedIcon fontSize="inherit" />
                        {agent.city}
                      </span>
                    </div>
                  </div>
                  <span
                    className="agent-card__badge"
                    style={{ background: statusStyle.bg, color: statusStyle.color }}
                  >
                    {agent.status}
                  </span>
                </div>

                <div className="agent-card__stats">
                  <div className="agent-card__stat">
                    <span className="agent-card__stat-value">
                      {agent.rating != null ? agent.rating : '—'}
                    </span>
                    <span className="agent-card__stat-label">Rating</span>
                  </div>
                  <div className="agent-card__stat">
                    <span className="agent-card__stat-value">{agent.trips}</span>
                    <span className="agent-card__stat-label">Trips</span>
                  </div>
                  <div className="agent-card__stat">
                    <span className="agent-card__stat-value">{formatEarned(agent.earned)}</span>
                    <span className="agent-card__stat-label">Earned</span>
                  </div>
                </div>

                <div className="agent-card__vehicle">
                  <span className="agent-card__vehicle-info">
                    <LocalShippingOutlinedIcon />
                    {agent.vehicle}
                  </span>
                  {agent.bookingId ? (
                    <span className="agent-card__booking-id">{agent.bookingId}</span>
                  ) : (
                    <span className="agent-card__no-booking">No active booking</span>
                  )}
                </div>

                <button
                  type="button"
                  className="agent-card__view-btn"
                  onClick={() => openProfile(agent)}
                >
                  View Profile
                </button>
              </article>
            );
          })}
        </div>
      )}

      {profileOpen ? (
        <div className="agent-profile-modal" role="dialog" aria-modal="true" aria-label="Agent profile">
          <div className="agent-profile-modal__backdrop" onClick={closeProfile} />
          <div className="agent-profile-modal__card">
            <div className="agent-profile-modal__header">
              <div>
                <h3>{profileAgent?.name || 'Agent profile'}</h3>
                <p>KYC details from agent registration</p>
              </div>
              <button
                type="button"
                className="agent-profile-modal__close"
                onClick={closeProfile}
                aria-label="Close profile"
              >
                <CloseOutlinedIcon />
              </button>
            </div>

            {profileLoading ? (
              <p className="agent-profile-modal__status">Loading profile...</p>
            ) : profileError ? (
              <p className="agent-profile-modal__status agent-profile-modal__status--error">
                {profileError}
              </p>
            ) : (
              <>
                {profileNotice && !profileData?.hasKyc ? (
                  <p className="agent-profile-modal__notice">{profileNotice}</p>
                ) : null}

                <div className="agent-profile-modal__grid">
                  {profileFields.map((field) => (
                    <div key={field.key} className="agent-profile-modal__field">
                      <span className="agent-profile-modal__label">{field.label}</span>
                      <span className="agent-profile-modal__value">
                        {profileData?.[field.key] || '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default Agents;
