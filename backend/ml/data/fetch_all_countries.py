# Sentinel AI — master data fetcher for all ~195 countries (Issue #22).
# Run once before the hackathon. Actual downloads are run separately (do not run in CI).
#
# Usage:
#   python -m backend.ml.data.fetch_all_countries --step countries
#   python -m backend.ml.data.fetch_all_countries --step gdelt
#   python -m backend.ml.data.fetch_all_countries --step acled
#   python -m backend.ml.data.fetch_all_countries --step ucdp
#   python -m backend.ml.data.fetch_all_countries --step worldbank
#   python -m backend.ml.data.fetch_all_countries --step models
#   python -m backend.ml.data.fetch_all_countries  (runs all steps)

from pathlib import Path


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def generate_countries_json() -> None:
    """Generate data/countries.json from scripts/generate_countries.py logic or run the script."""
    import subprocess
    import sys
    repo = _repo_root()
    script = repo / "scripts" / "generate_countries.py"
    if script.exists():
        subprocess.check_call([sys.executable, str(script)], cwd=str(repo))
    else:
        # Inline fallback: ensure data/countries.json exists (e.g. committed file)
        path = repo / "data" / "countries.json"
        if not path.exists():
            raise FileNotFoundError("data/countries.json not found; create it via scripts/generate_countries.py")


def main() -> None:
    import argparse
    import os

    parser = argparse.ArgumentParser(description="Fetch all country data for Sentinel (GDELT, ACLED, UCDP, World Bank, models)")
    parser.add_argument(
        "--step",
        choices=["all", "countries", "gdelt", "acled", "ucdp", "worldbank", "models"],
        default="all",
        help="Step to run (default: all)",
    )
    args = parser.parse_args()

    step = args.step

    if step in ("all", "countries"):
        print("Step: countries — generating data/countries.json")
        generate_countries_json()

    if step in ("all", "gdelt"):
        print("Step: GDELT — fetch_gdelt_all_countries (full history, chunked)")
        from backend.ml.data.fetch_gdelt import fetch_gdelt_all_countries
        fetch_gdelt_all_countries(days_back=3650)

    if step in ("all", "acled"):
        print("Step: ACLED — fetch_acled_all_countries (1997-present)")
        from backend.ml.data.fetch_acled import get_acled_token, fetch_acled_all_countries
        from dotenv import load_dotenv
        load_dotenv()
        username = os.getenv("ACLED_USERNAME")
        password = os.getenv("ACLED_PASSWORD")
        if not username or not password:
            print("Set ACLED_USERNAME and ACLED_PASSWORD in .env to run ACLED step")
        else:
            token = get_acled_token(username, password)
            fetch_acled_all_countries(token, start_date="1997-01-01")

    if step in ("all", "ucdp"):
        print("Step: UCDP — split_ucdp_global()")
        from backend.ml.data.fetch_ucdp import split_ucdp_global
        split_ucdp_global()

    if step in ("all", "worldbank"):
        print("Step: World Bank — fetch_world_bank_all_countries(mrv=30)")
        from backend.ml.data.fetch_world_bank import fetch_world_bank_all_countries
        fetch_world_bank_all_countries(mrv=30)

    if step in ("all", "models"):
        print("Step: models — train anomaly detectors + XGBoost risk scorer")
        from backend.ml.anomaly import train_all_anomaly_detectors
        train_all_anomaly_detectors()
        from backend.ml.risk_scorer import build_training_dataset, train_risk_scorer
        df = build_training_dataset()
        if not df.empty:
            train_risk_scorer(df)
        else:
            print("  No training data; skip XGBoost training")


if __name__ == "__main__":
    main()
