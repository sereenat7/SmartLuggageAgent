import { useEffect, useMemo, useState } from 'react';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import ReplyOutlinedIcon from '@mui/icons-material/ReplyOutlined';
import SendIcon from '@mui/icons-material/Send';
import { COMPLAINT_STATUSES, priorityStyles, complaintStatusStyles } from '../data/complaintStyles';
import { fetchComplaints, sendComplaintReply } from '../services/complaints';
import './Complaints.css';

function Complaints() {
  const [complaints, setComplaints] = useState([]);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [replyingToId, setReplyingToId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [replyError, setReplyError] = useState('');
  const [replySuccess, setReplySuccess] = useState('');

  useEffect(() => {
    let active = true;

    async function loadComplaints() {
      try {
        setError('');
        const data = await fetchComplaints();
        if (active) setComplaints(data);
      } catch (err) {
        if (active) {
          setError(err.message || 'Failed to load complaints. Make sure the backend is running.');
          setComplaints([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadComplaints();
    const intervalId = window.setInterval(loadComplaints, 10000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const filteredComplaints = useMemo(() => {
    const query = search.trim().toLowerCase();

    return complaints.filter((complaint) => {
      const matchesFilter = activeFilter === 'All' || complaint.status === activeFilter;
      const matchesSearch =
        !query ||
        complaint.name.toLowerCase().includes(query) ||
        complaint.referenceId.toLowerCase().includes(query) ||
        complaint.issueType.toLowerCase().includes(query) ||
        complaint.text.toLowerCase().includes(query);

      return matchesFilter && matchesSearch;
    });
  }, [complaints, search, activeFilter]);

  const handleReplyClick = (complaintId) => {
    setReplyError('');
    setReplySuccess('');
    if (replyingToId === complaintId) {
      setReplyingToId(null);
      setReplyText('');
      return;
    }
    setReplyingToId(complaintId);
    setReplyText('');
  };

  const handleSendReply = async (complaintId) => {
    if (!replyText.trim()) {
      setReplyError('Please enter a reply message.');
      return;
    }

    try {
      setSendingReply(true);
      setReplyError('');
      setReplySuccess('');

      const result = await sendComplaintReply(complaintId, replyText.trim());

      if (result.complaint) {
        setComplaints((prev) =>
          prev.map((item) => (item.id === complaintId ? result.complaint : item))
        );
      }

      setReplySuccess(result.message || 'Reply sent to the user\'s email.');
      setReplyingToId(null);
      setReplyText('');
      window.dispatchEvent(new Event('complaint-count-changed'));
    } catch (err) {
      setReplyError(err.response?.data?.message || err.message || 'Failed to send reply.');
    } finally {
      setSendingReply(false);
    }
  };

  return (
    <div className="complaints-page">
      <div className="complaints-page__intro">
        <h2>Complaints</h2>
        <p>Support inbox and customer feedback</p>
      </div>

      <section>
        <h3 className="complaints-section__title">
          Active Complaints ({filteredComplaints.length})
        </h3>

        {error ? (
          <p className="complaints-page__status complaints-page__status--error">{error}</p>
        ) : null}

        <div className="complaints-panel">
          <div className="complaints-toolbar">
            <div className="complaints-toolbar__search">
              <span className="complaints-toolbar__search-icon" aria-hidden="true">
                <SearchOutlinedIcon />
              </span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name, ID, or issue..."
                aria-label="Search complaints"
                disabled={loading}
              />
            </div>

            <div className="complaints-filters" role="tablist" aria-label="Filter complaints by status">
              {COMPLAINT_STATUSES.map((status) => (
                <button
                  key={status}
                  type="button"
                  role="tab"
                  aria-selected={activeFilter === status}
                  className={`complaints-filter${activeFilter === status ? ' complaints-filter--active' : ''}`}
                  onClick={() => setActiveFilter(status)}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <p className="complaints-page__status">Loading complaints...</p>
          ) : complaints.length === 0 ? (
            <p className="complaints-page__status">No complaints submitted yet.</p>
          ) : filteredComplaints.length === 0 ? (
            <p className="complaints-page__status">No complaints match your search or filter.</p>
          ) : (
            <div className="complaints-list">
              {filteredComplaints.map((complaint) => {
              const priorityStyle = priorityStyles[complaint.priority] || priorityStyles.Medium;
              const statusStyle =
                complaintStatusStyles[complaint.status] || complaintStatusStyles.Open;
              const isReplying = replyingToId === complaint.id;

              return (
                <article key={complaint.id} className="complaint-card">
                  <div className="complaint-card__main">
                    <span
                      className="complaint-card__avatar"
                      style={{ background: complaint.color }}
                      aria-hidden="true"
                    >
                      {complaint.initials}
                    </span>

                    <div className="complaint-card__body">
                      <div className="complaint-card__header">
                        <span className="complaint-card__name">{complaint.name}</span>
                        <span className="complaint-card__booking-id">{complaint.referenceId}</span>
                        <span className="complaint-card__issue-tag">{complaint.issueType}</span>
                      </div>

                      <p className="complaint-card__text">{complaint.text}</p>

                      {complaint.adminReply ? (
                        <p className="complaint-card__admin-reply">
                          <strong>Your reply:</strong> {complaint.adminReply}
                          {complaint.repliedAt ? (
                            <span className="complaint-card__replied-at"> · {complaint.repliedAt}</span>
                          ) : null}
                        </p>
                      ) : null}

                      <div className="complaint-card__meta">
                        <span
                          className="complaint-card__tag"
                          style={{ background: priorityStyle.bg, color: priorityStyle.color }}
                        >
                          {complaint.priority}
                        </span>
                        <span
                          className="complaint-card__status"
                          style={{
                            background: statusStyle.bg,
                            color: statusStyle.color,
                            borderColor: statusStyle.border,
                          }}
                        >
                          {complaint.status}
                        </span>
                        <span className="complaint-card__date">{complaint.date}</span>
                      </div>

                      {isReplying ? (
                        <div className="complaint-card__reply-panel">
                          <textarea
                            className="complaint-card__reply-input"
                            placeholder="Type your reply to the customer..."
                            value={replyText}
                            onChange={(event) => setReplyText(event.target.value)}
                            rows={4}
                          />
                          <button
                            type="button"
                            className="complaint-card__send-reply"
                            onClick={() => handleSendReply(complaint.id)}
                            disabled={sendingReply}
                          >
                            <SendIcon />
                            {sendingReply ? 'Sending...' : 'Send Reply'}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <button
                    type="button"
                    className={`complaint-card__reply${isReplying ? ' complaint-card__reply--active' : ''}`}
                    onClick={() => handleReplyClick(complaint.id)}
                  >
                    <ReplyOutlinedIcon />
                    {isReplying ? 'Cancel' : 'Reply'}
                  </button>
                </article>
              );
            })}
            </div>
          )}
        </div>

        {replyError ? (
          <p className="complaints-page__status complaints-page__status--error">{replyError}</p>
        ) : null}
        {replySuccess ? (
          <p className="complaints-page__status complaints-page__status--success">{replySuccess}</p>
        ) : null}
      </section>
    </div>
  );
}

export default Complaints;
