import { useEffect, useMemo, useState } from 'react';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import { fetchReviews } from '../services/reviews';
import './Reviews.css';

const REVIEW_RATINGS = ['All', '5 Stars', '4 Stars', '3 Stars', '2 Stars', '1 Star'];

function StarRating({ rating }) {
  return (
    <div className="review-card__stars" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => {
        const filled = index < rating;
        return filled ? (
          <StarIcon key={index} className="review-card__star--filled" fontSize="inherit" />
        ) : (
          <StarBorderIcon key={index} className="review-card__star--empty" fontSize="inherit" />
        );
      })}
    </div>
  );
}

function Reviews() {
  const [reviews, setReviews] = useState([]);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadReviews() {
      try {
        setError('');
        const data = await fetchReviews();
        if (active) setReviews(data);
      } catch (err) {
        if (active) {
          setError(err.message || 'Failed to load reviews. Make sure the backend is running.');
          setReviews([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadReviews();
    const intervalId = window.setInterval(loadReviews, 10000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const filteredReviews = useMemo(() => {
    const query = search.trim().toLowerCase();
    const ratingFilter =
      activeFilter === 'All' ? null : Number.parseInt(activeFilter, 10);

    return reviews.filter((review) => {
      const matchesFilter = ratingFilter === null || review.rating === ratingFilter;
      const matchesSearch =
        !query ||
        review.name.toLowerCase().includes(query) ||
        review.text.toLowerCase().includes(query) ||
        (review.category && review.category.toLowerCase().includes(query));

      return matchesFilter && matchesSearch;
    });
  }, [reviews, search, activeFilter]);

  return (
    <div className="reviews-page">
      <div className="reviews-page__intro">
        <h2>Reviews</h2>
        <p>Customer ratings and feedback</p>
      </div>

      <section>
        <h3 className="reviews-section__title">
          Recent Reviews ({filteredReviews.length})
        </h3>

        {error ? (
          <p className="reviews-page__status reviews-page__status--error">{error}</p>
        ) : null}

        <div className="reviews-panel">
          <div className="reviews-toolbar">
            <div className="reviews-toolbar__search">
              <span className="reviews-toolbar__search-icon" aria-hidden="true">
                <SearchOutlinedIcon />
              </span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name or feedback..."
                aria-label="Search reviews"
                disabled={loading}
              />
            </div>

            <div className="reviews-filters" role="tablist" aria-label="Filter reviews by rating">
              {REVIEW_RATINGS.map((rating) => (
                <button
                  key={rating}
                  type="button"
                  role="tab"
                  aria-selected={activeFilter === rating}
                  className={`reviews-filter${activeFilter === rating ? ' reviews-filter--active' : ''}`}
                  onClick={() => setActiveFilter(rating)}
                >
                  {rating}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <p className="reviews-page__status">Loading reviews...</p>
          ) : reviews.length === 0 ? (
            <p className="reviews-page__status">No feedback submitted yet.</p>
          ) : filteredReviews.length === 0 ? (
            <p className="reviews-page__status">No reviews match your search or filter.</p>
          ) : (
            <div className="reviews-list">
              {filteredReviews.map((review) => (
                <article key={review.id} className="review-card">
                <div className="review-card__top">
                  <div className="review-card__profile">
                    <span
                      className="review-card__avatar"
                      style={{ background: review.color }}
                      aria-hidden="true"
                    >
                      {review.initials}
                    </span>
                    <div className="review-card__info">
                      <h4 className="review-card__name">{review.name}</h4>
                      <StarRating rating={review.rating} />
                    </div>
                  </div>
                  <span className="review-card__date">{review.date}</span>
                </div>
                <p className="review-card__text">{review.text}</p>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default Reviews;
