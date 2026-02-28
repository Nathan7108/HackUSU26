# Sentinel AI — PredictionTracker (SQLite logging)
# S3-01: log predictions, get track record, compute accuracy. See GitHub Issue #21.

import json
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


class PredictionTracker:
    """
    SQLite-based logging of all predictions for track-record and accuracy.
    """

    def __init__(self, db_path: str | None = None):
        if db_path is None:
            db_path = str(_repo_root() / "sentinel_predictions.db")
        self.db_path = db_path
        self._init_db()

    def _init_db(self) -> None:
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS predictions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    country_code TEXT NOT NULL,
                    predicted_at TEXT NOT NULL,
                    risk_level TEXT NOT NULL,
                    risk_score INTEGER NOT NULL,
                    confidence REAL NOT NULL,
                    feature_snapshot TEXT,
                    model_version TEXT,
                    actual_risk_level TEXT,
                    prediction_correct INTEGER
                )
            """)
            conn.commit()

    def log_prediction(
        self,
        country_code: str,
        prediction: dict,
        features: dict,
        model_version: str = "2.0.0",
    ) -> None:
        """Insert one prediction into SQLite."""
        predicted_at = datetime.utcnow().isoformat() + "Z"
        risk_level = prediction.get("risk_level", "")
        risk_score = int(prediction.get("risk_score", 0))
        confidence = float(prediction.get("confidence", 0))
        feature_snapshot = json.dumps(features) if features else "{}"
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                INSERT INTO predictions
                (country_code, predicted_at, risk_level, risk_score, confidence,
                 feature_snapshot, model_version, actual_risk_level, prediction_correct)
                VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL)
                """,
                (country_code, predicted_at, risk_level, risk_score, confidence, feature_snapshot, model_version),
            )
            conn.commit()

    def get_track_record(self, limit: int = 20) -> list[dict]:
        """Return recent predictions for UI (newest first)."""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cur = conn.execute(
                """
                SELECT country_code, predicted_at, risk_level, risk_score, confidence,
                       model_version, actual_risk_level, prediction_correct
                FROM predictions
                ORDER BY predicted_at DESC
                LIMIT ?
                """,
                (limit,),
            )
            rows = cur.fetchall()
        return [dict(row) for row in rows]

    def backfill_accuracy(self, min_gap_days: int = 7) -> int:
        """
        Compare each prediction to the next prediction for the same country
        that is at least min_gap_days later. Within-1-tier = correct.
        Returns number of rows updated.
        """
        tier_order = {"LOW": 0, "MODERATE": 1, "ELEVATED": 2, "HIGH": 3, "CRITICAL": 4}
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cur = conn.execute(
                """
                SELECT id, country_code, predicted_at, risk_level
                FROM predictions
                WHERE prediction_correct IS NULL
                ORDER BY country_code, predicted_at
                """
            )
            rows = [dict(r) for r in cur.fetchall()]

        if not rows:
            return 0

        # Group by country
        by_country: dict[str, list[dict]] = {}
        for r in rows:
            by_country.setdefault(r["country_code"], []).append(r)

        updates = []
        for country_code, preds in by_country.items():
            # Fetch all predictions for this country as "later" evidence
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                all_cur = conn.execute(
                    """
                    SELECT predicted_at, risk_level FROM predictions
                    WHERE country_code = ?
                    ORDER BY predicted_at
                    """,
                    (country_code,),
                )
                all_preds = [dict(r) for r in all_cur.fetchall()]

            for pred in preds:
                pred_time = datetime.fromisoformat(pred["predicted_at"].replace("Z", ""))
                pred_level = pred["risk_level"]
                pred_tier = tier_order.get(pred_level, -1)

                # Find the next prediction for same country that is >= min_gap_days later
                for later in all_preds:
                    later_time = datetime.fromisoformat(later["predicted_at"].replace("Z", ""))
                    if (later_time - pred_time).days >= min_gap_days:
                        later_level = later["risk_level"]
                        later_tier = tier_order.get(later_level, -1)
                        # Within 1 tier = correct
                        correct = 1 if abs(pred_tier - later_tier) <= 1 else 0
                        updates.append((later_level, correct, pred["id"]))
                        break

        if updates:
            with sqlite3.connect(self.db_path) as conn:
                conn.executemany(
                    "UPDATE predictions SET actual_risk_level = ?, prediction_correct = ? WHERE id = ?",
                    updates,
                )
                conn.commit()
        return len(updates)

    def compute_accuracy(self, days_back: int = 90) -> dict:
        """Calculate accuracy metrics over the last N days (where prediction_correct is set)."""
        since = (datetime.utcnow() - timedelta(days=days_back)).isoformat() + "Z"
        with sqlite3.connect(self.db_path) as conn:
            cur = conn.execute(
                """
                SELECT prediction_correct FROM predictions
                WHERE predicted_at >= ? AND prediction_correct IS NOT NULL
                """,
                (since,),
            )
            rows = cur.fetchall()
        if not rows:
            return {
                "total_evaluated": 0,
                "correct": 0,
                "accuracy_pct": 0.0,
                "days_back": days_back,
            }
        total = len(rows)
        correct = sum(1 for (r,) in rows if r == 1)
        return {
            "total_evaluated": total,
            "correct": correct,
            "accuracy_pct": round(100.0 * correct / total, 1) if total else 0.0,
            "days_back": days_back,
        }
