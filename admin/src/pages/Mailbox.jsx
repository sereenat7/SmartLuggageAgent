import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import ReplyOutlinedIcon from '@mui/icons-material/ReplyOutlined';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import { mailboxFolders } from '../data/mailboxData';
import {
  attachmentUrl,
  fetchMailboxMessage,
  fetchMailboxMessages,
  fetchMailboxUnreadCount,
  moveMailboxMessage,
  deleteMailboxMessage,
  replyMailboxMessage,
  sendMailboxEmail,
  syncMailbox,
} from '../services/mailbox';
import './Mailbox.css';

const folderIcons = {
  inbox: InboxOutlinedIcon,
  sent: SendOutlinedIcon,
  trash: DeleteOutlineOutlinedIcon,
};

function Mailbox() {
  const [activeFolder, setActiveFolder] = useState('inbox');
  const [messages, setMessages] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeFiles, setComposeFiles] = useState([]);

  const [replyBody, setReplyBody] = useState('');
  const [replyFiles, setReplyFiles] = useState([]);
  const [inboxUnread, setInboxUnread] = useState(0);
  const [trashingId, setTrashingId] = useState(null);

  const composeFileRef = useRef(null);
  const replyFileRef = useRef(null);

  const loadMessages = useCallback(async () => {
    try {
      setError('');
      const data = await fetchMailboxMessages(activeFolder);
      setMessages(data);
      const unread = await fetchMailboxUnreadCount();
      setInboxUnread(unread);
      window.dispatchEvent(new Event('mailbox-count-changed'));
    } catch (err) {
      setError(err.message || 'Failed to load mailbox.');
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [activeFolder]);

  useEffect(() => {
    let active = true;

    async function init() {
      setLoading(true);
      try {
        await syncMailbox();
      } catch {
        // sync is best-effort
      }
      if (active) await loadMessages();
    }

    init();
    const intervalId = window.setInterval(async () => {
      try {
        await syncMailbox();
      } catch {
        // ignore
      }
      if (active) await loadMessages();
    }, 30000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [loadMessages]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedMessage(null);
      setReplyOpen(false);
      return;
    }

    let active = true;

    async function loadSelected() {
      try {
        const message = await fetchMailboxMessage(selectedId);
        if (active) {
          setSelectedMessage(message);
          setMessages((prev) =>
            prev.map((item) =>
              item.id === selectedId ? { ...item, unread: false } : item
            )
          );
          window.dispatchEvent(new Event('mailbox-count-changed'));
        }
      } catch (err) {
        if (active) setStatus(err.message || 'Failed to load message.');
      }
    }

    loadSelected();
    return () => {
      active = false;
    };
  }, [selectedId]);

  const folderMessages = useMemo(() => {
    const query = search.trim().toLowerCase();
    return messages.filter((message) => {
      const matchesSearch =
        !query ||
        message.sender.toLowerCase().includes(query) ||
        message.subject.toLowerCase().includes(query) ||
        message.preview.toLowerCase().includes(query);
      return matchesSearch;
    });
  }, [messages, search]);

  const unreadCount = inboxUnread;

  const resetCompose = () => {
    setComposeTo('');
    setComposeSubject('');
    setComposeBody('');
    setComposeFiles([]);
  };

  const resetReply = () => {
    setReplyBody('');
    setReplyFiles([]);
    setReplyOpen(false);
  };

  const handleComposeSend = async () => {
    if (!composeTo.trim() || !composeSubject.trim() || !composeBody.trim()) {
      setStatus('Please fill in To, Subject, and Message.');
      return;
    }

    try {
      setSending(true);
      setStatus('');
      const result = await sendMailboxEmail({
        to: composeTo.trim(),
        subject: composeSubject.trim(),
        message: composeBody.trim(),
        attachments: composeFiles,
      });
      setComposeOpen(false);
      resetCompose();
      setActiveFolder('sent');
      setLoading(true);
      const sentMessages = await fetchMailboxMessages('sent');
      setMessages(sentMessages);
      setLoading(false);
      const newId = result.messageId || result.savedMessage?.id || sentMessages[0]?.id;
      if (newId) {
        setSelectedId(newId);
        const detail = result.savedMessage || (await fetchMailboxMessage(newId));
        setSelectedMessage(detail);
      }
      setStatus('Email sent — view it in Sent.');
      window.dispatchEvent(new Event('mailbox-count-changed'));
    } catch (err) {
      setStatus(err.response?.data?.message || err.message || 'Failed to send email.');
    } finally {
      setSending(false);
    }
  };

  const handleReplySend = async () => {
    if (!selectedId || !replyBody.trim()) {
      setStatus('Please enter a reply message.');
      return;
    }

    try {
      setSending(true);
      setStatus('');
      await replyMailboxMessage(selectedId, {
        message: replyBody.trim(),
        attachments: replyFiles,
      });
      resetReply();
      setStatus('Reply sent successfully.');
      const refreshed = await fetchMailboxMessage(selectedId);
      setSelectedMessage(refreshed);
      setMessages((prev) =>
        prev.map((item) =>
          item.id === selectedId
            ? { ...item, unread: false, adminReply: refreshed.adminReply, repliedAt: refreshed.repliedAt, hasReplied: true }
            : item
        )
      );
      await loadMessages();
      window.dispatchEvent(new Event('mailbox-count-changed'));
    } catch (err) {
      setStatus(err.response?.data?.message || err.message || 'Failed to send reply.');
    } finally {
      setSending(false);
    }
  };

  const handleTrash = async (messageId) => {
    if (!messageId || trashingId) return;

    try {
      setTrashingId(messageId);
      setStatus('');

      if (activeFolder === 'trash') {
        await deleteMailboxMessage(messageId);
        setStatus('Message deleted permanently.');
      } else {
        await moveMailboxMessage(messageId, 'trash');
        setStatus('Message moved to Trash.');
      }

      if (selectedId === messageId) {
        setSelectedId(null);
        setSelectedMessage(null);
        setReplyOpen(false);
      }

      setMessages((prev) => prev.filter((item) => item.id !== messageId));
      const unread = await fetchMailboxUnreadCount();
      setInboxUnread(unread);
      window.dispatchEvent(new Event('mailbox-count-changed'));
    } catch (err) {
      setStatus(err.response?.data?.message || err.message || 'Failed to move message to Trash.');
      await loadMessages();
    } finally {
      setTrashingId(null);
    }
  };

  const onComposeFiles = (event) => {
    setComposeFiles(Array.from(event.target.files || []));
  };

  const onReplyFiles = (event) => {
    setReplyFiles(Array.from(event.target.files || []));
  };

  const closeMessage = () => {
    setSelectedId(null);
    setSelectedMessage(null);
    setReplyOpen(false);
  };

  return (
    <div className="mailbox-page">
      <div className="mailbox-page__header">
        <div className="mailbox-page__intro">
          <h2>Mailbox</h2>
          <p>Support mail — smartluggage.support@gmail.com</p>
        </div>
        <button
          type="button"
          className="mailbox-page__compose"
          onClick={() => {
            setComposeOpen(true);
            setStatus('');
          }}
        >
          <AddOutlinedIcon />
          Compose
        </button>
      </div>

      {error ? <p className="mailbox-page__status mailbox-page__status--error">{error}</p> : null}
      {status ? <p className="mailbox-page__status">{status}</p> : null}

      <div className={`mailbox-shell${selectedMessage ? ' mailbox-shell--reading' : ''}`}>
        <nav className="mailbox-folders" aria-label="Mail folders">
          <ul className="mailbox-folders__list">
            {mailboxFolders.map((folder) => {
              const Icon = folderIcons[folder.icon];
              const badge = folder.id === 'inbox' ? unreadCount : null;

              return (
                <li key={folder.id}>
                  <button
                    type="button"
                    className={`mailbox-folder${activeFolder === folder.id ? ' mailbox-folder--active' : ''}`}
                    onClick={() => {
                      setActiveFolder(folder.id);
                      setSelectedId(null);
                      setSelectedMessage(null);
                      setReplyOpen(false);
                      setLoading(true);
                    }}
                  >
                    <Icon />
                    <span>{folder.label}</span>
                    {badge > 0 ? <span className="mailbox-folder__badge">{badge}</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {!selectedMessage ? (
        <div className="mailbox-list-pane mailbox-list-pane--expanded">
          <div className="mailbox-list-pane__search">
            <span className="mailbox-list-pane__search-icon" aria-hidden="true">
              <SearchOutlinedIcon />
            </span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search mail..."
              aria-label="Search mail"
            />
          </div>

          <ul className="mailbox-list">
            {loading ? (
              <li className="mailbox-detail__empty">Loading messages...</li>
            ) : folderMessages.length === 0 ? (
              <li className="mailbox-detail__empty">No messages in this folder.</li>
            ) : (
              folderMessages.map((message) => (
                <li key={message.id} className="mailbox-list__entry">
                  <button
                    type="button"
                    className={`mailbox-list__item${selectedId === message.id ? ' mailbox-list__item--active' : ''}${message.unread ? ' mailbox-list__item--unread' : ''}`}
                    onClick={() => {
                      setSelectedId(message.id);
                      setReplyOpen(false);
                      setStatus('');
                    }}
                  >
                    <div className="mailbox-list__row">
                      <span className="mailbox-list__sender-wrap">
                        {message.unread ? <span className="mailbox-list__dot" aria-hidden="true" /> : null}
                        <span className="mailbox-list__sender">{message.sender}</span>
                      </span>
                      <span className="mailbox-list__time">{message.time}</span>
                    </div>
                    <p className="mailbox-list__subject">{message.subject}</p>
                    <p className="mailbox-list__preview">
                      {message.hasReplied ? (
                        <span className="mailbox-list__replied-tag">Replied · </span>
                      ) : null}
                      {message.preview}
                    </p>
                  </button>
                  <button
                    type="button"
                    className="mailbox-list__trash-btn"
                    aria-label={activeFolder === 'trash' ? 'Delete permanently' : 'Move to Trash'}
                    disabled={trashingId === message.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleTrash(message.id);
                    }}
                  >
                    <DeleteOutlineOutlinedIcon />
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
        ) : (
        <div className="mailbox-detail mailbox-detail--expanded">
              <div className="mailbox-detail__header">
                <button
                  type="button"
                  className="mailbox-detail__back"
                  onClick={closeMessage}
                  aria-label="Back to mail list"
                >
                  <ArrowBackOutlinedIcon />
                  <span>Back</span>
                </button>
                <h3 className="mailbox-detail__subject">{selectedMessage.subject}</h3>
                <div className="mailbox-detail__actions">
                  {activeFolder === 'inbox' ? (
                    <button
                      type="button"
                      className="mailbox-detail__action-btn"
                      aria-label="Reply"
                      onClick={() => {
                        setReplyOpen(true);
                        setReplyBody('');
                        setReplyFiles([]);
                      }}
                    >
                      <ReplyOutlinedIcon />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="mailbox-detail__action-btn"
                    aria-label={activeFolder === 'trash' ? 'Delete permanently' : 'Move to Trash'}
                    disabled={trashingId === selectedId}
                    onClick={() => handleTrash(selectedId)}
                  >
                    <DeleteOutlineOutlinedIcon />
                  </button>
                </div>
              </div>

              <div className="mailbox-detail__meta">
                <span
                  className="mailbox-detail__avatar"
                  style={{ background: selectedMessage.color }}
                  aria-hidden="true"
                >
                  {selectedMessage.initials}
                </span>
                <div className="mailbox-detail__sender-info">
                  <span className="mailbox-detail__sender-name">{selectedMessage.sender}</span>
                  <span className="mailbox-detail__sender-email">{selectedMessage.senderEmail}</span>
                </div>
              </div>

              <div className="mailbox-detail__body">
                {selectedMessage.body.map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}

                {selectedMessage.attachments?.length > 0 ? (
                  <div className="mailbox-attachments">
                    <h4 className="mailbox-attachments__title">Attachments</h4>
                    <div className="mailbox-attachments__grid">
                      {selectedMessage.attachments.map((attachment) =>
                        attachment.isImage ? (
                          <a
                            key={attachment.id}
                            href={attachmentUrl(attachment.id)}
                            target="_blank"
                            rel="noreferrer"
                            className="mailbox-attachments__image-link"
                          >
                            <img
                              src={attachmentUrl(attachment.id)}
                              alt={attachment.filename}
                              className="mailbox-attachments__image"
                            />
                            <span>{attachment.filename}</span>
                          </a>
                        ) : (
                          <a
                            key={attachment.id}
                            href={attachmentUrl(attachment.id)}
                            target="_blank"
                            rel="noreferrer"
                            className="mailbox-attachments__file"
                          >
                            <AttachFileOutlinedIcon />
                            <span>{attachment.filename}</span>
                          </a>
                        )
                      )}
                    </div>
                  </div>
                ) : null}

                {selectedMessage.adminReply ? (
                  <div className="mailbox-admin-reply">
                    <h4 className="mailbox-admin-reply__title">Your reply</h4>
                    <p className="mailbox-admin-reply__text">{selectedMessage.adminReply}</p>
                    {selectedMessage.repliedAt ? (
                      <span className="mailbox-admin-reply__time">Sent · {selectedMessage.repliedAt}</span>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {replyOpen ? (
                <div className="mailbox-reply-panel">
                  <textarea
                    className="mailbox-reply-panel__input"
                    placeholder="Write your reply..."
                    value={replyBody}
                    onChange={(event) => setReplyBody(event.target.value)}
                    rows={5}
                  />
                  <div className="mailbox-reply-panel__footer">
                    <input
                      ref={replyFileRef}
                      type="file"
                      multiple
                      className="mailbox-file-input"
                      onChange={onReplyFiles}
                    />
                    <button
                      type="button"
                      className="mailbox-attach-btn"
                      onClick={() => replyFileRef.current?.click()}
                    >
                      <AttachFileOutlinedIcon />
                      Attach
                    </button>
                    {replyFiles.length > 0 ? (
                      <span className="mailbox-file-count">{replyFiles.length} file(s)</span>
                    ) : null}
                    <button
                      type="button"
                      className="mailbox-send-btn"
                      onClick={handleReplySend}
                      disabled={sending}
                    >
                      {sending ? 'Sending...' : 'Send Reply'}
                    </button>
                  </div>
                </div>
              ) : null}
        </div>
        )}
      </div>

      {composeOpen ? (
        <div className="mailbox-modal" role="dialog" aria-modal="true" aria-label="Compose email">
          <div className="mailbox-modal__backdrop" onClick={() => setComposeOpen(false)} />
          <div className="mailbox-modal__card">
            <div className="mailbox-modal__header">
              <h3>Compose Email</h3>
              <button type="button" className="mailbox-modal__close" onClick={() => setComposeOpen(false)}>
                <CloseOutlinedIcon />
              </button>
            </div>

            <label className="mailbox-modal__label">
              To
              <input
                type="email"
                value={composeTo}
                onChange={(event) => setComposeTo(event.target.value)}
                placeholder="customer@example.com"
              />
            </label>

            <label className="mailbox-modal__label">
              Subject
              <input
                type="text"
                value={composeSubject}
                onChange={(event) => setComposeSubject(event.target.value)}
                placeholder="Subject"
              />
            </label>

            <label className="mailbox-modal__label">
              Message
              <textarea
                value={composeBody}
                onChange={(event) => setComposeBody(event.target.value)}
                placeholder="Write your message..."
                rows={8}
              />
            </label>

            <div className="mailbox-modal__footer">
              <input
                ref={composeFileRef}
                type="file"
                multiple
                className="mailbox-file-input"
                onChange={onComposeFiles}
              />
              <button
                type="button"
                className="mailbox-attach-btn"
                onClick={() => composeFileRef.current?.click()}
              >
                <AttachFileOutlinedIcon />
                Attach document
              </button>
              {composeFiles.length > 0 ? (
                <span className="mailbox-file-count">{composeFiles.length} file(s) selected</span>
              ) : null}
              <button
                type="button"
                className="mailbox-send-btn"
                onClick={handleComposeSend}
                disabled={sending}
              >
                {sending ? 'Sending...' : 'Send Email'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default Mailbox;
