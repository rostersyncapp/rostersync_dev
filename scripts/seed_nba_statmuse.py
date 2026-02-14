#!/usr/bin/env python3
"""
NBA StatMuse Roster Seeder (Python Version)
Scrapes NBA roster data from StatMuse and saves to Supabase or CSV.

Usage: 
    python3 scripts/seed_nba_statmuse.py [startYear] [endYear] [team_id] [--csv=file.csv]
"""

import os
import sys
import time
import requests
import csv
import unicodedata
import re
from bs4 import BeautifulSoup
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Error: Missing Supabase credentials in .env")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# NBA Team Mapping
STATMUSE_NBA_TEAMS = [
  {"id": "atlanta-hawks", "slug": "atlanta-hawks", "statmuseId": 22},
  {"id": "boston-celtics", "slug": "boston-celtics", "statmuseId": 1},
  {"id": "brooklyn-nets", "slug": "brooklyn-nets", "statmuseId": 33},
  {"id": "charlotte-hornets", "slug": "charlotte-hornets", "statmuseId": 53},
  {"id": "chicago-bulls", "slug": "chicago-bulls", "statmuseId": 25},
  {"id": "cleveland-cavaliers", "slug": "cleveland-cavaliers", "statmuseId": 42},
  {"id": "dallas-mavericks", "slug": "dallas-mavericks", "statmuseId": 46},
  {"id": "denver-nuggets", "slug": "denver-nuggets", "statmuseId": 28},
  {"id": "detroit-pistons", "slug": "detroit-pistons", "statmuseId": 13},
  {"id": "golden-state-warriors", "slug": "golden-state-warriors", "statmuseId": 6},
  {"id": "houston-rockets", "slug": "houston-rockets", "statmuseId": 37},
  {"id": "indiana-pacers", "slug": "indiana-pacers", "statmuseId": 30},
  {"id": "los-angeles-clippers", "slug": "la-clippers", "statmuseId": 41},
  {"id": "los-angeles-lakers", "slug": "los-angeles-lakers", "statmuseId": 15},
  {"id": "memphis-grizzlies", "slug": "memphis-grizzlies", "statmuseId": 52},
  {"id": "miami-heat", "slug": "miami-heat", "statmuseId": 48},
  {"id": "milwaukee-bucks", "slug": "milwaukee-bucks", "statmuseId": 39},
  {"id": "minnesota-timberwolves", "slug": "minnesota-timberwolves", "statmuseId": 49},
  {"id": "new-orleans-pelicans", "slug": "new-orleans-pelicans", "statmuseId": 47},
  {"id": "new-york-knicks", "slug": "new-york-knicks", "statmuseId": 5},
  {"id": "oklahoma-city-thunder", "slug": "oklahoma-city-thunder", "statmuseId": 38},
  {"id": "orlando-magic", "slug": "orlando-magic", "statmuseId": 50},
  {"id": "philadelphia-76ers", "slug": "philadelphia-76ers", "statmuseId": 21},
  {"id": "phoenix-suns", "slug": "phoenix-suns", "statmuseId": 40},
  {"id": "portland-trail-blazers", "slug": "portland-trail-blazers", "statmuseId": 43},
  {"id": "sacramento-kings", "slug": "sacramento-kings", "statmuseId": 16},
  {"id": "san-antonio-spurs", "slug": "san-antonio-spurs", "statmuseId": 27},
  {"id": "toronto-raptors", "slug": "toronto-raptors", "statmuseId": 51},
  {"id": "utah-jazz", "slug": "utah-jazz", "statmuseId": 45},
  {"id": "washington-wizards", "slug": "washington-wizards", "statmuseId": 24}
]

def clean_name(name):
    # Remove diacritics/accents
    name = unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode('ascii')
    
    # Handle StatMuse name redundancy
    match = re.search(r"(.+?)([A-Z]\. .+)$", name)
    if match:
        full_name, abbrev = match.groups()
        initial = abbrev[0]
        last_name_part = abbrev[3:]
        if full_name.startswith(initial) and full_name.endswith(last_name_part):
            return full_name

    parts = name.split()
    if len(parts) >= 3:
        last_part = parts[-1]
        second_to_last = parts[-2]
        if "." in second_to_last and last_part == parts[-3]:
            return " ".join(parts[:-2])
    return name

def fetch_roster(team, year):
    url = f"https://www.statmuse.com/nba/team/{team['slug']}-{team['statmuseId']}/roster/{year}"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }

    try:
        response = requests.get(url, headers=headers)
        if response.status_code == 404:
            return []
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        table = soup.find('table')
        if not table:
            return []

        players = []
        rows = table.find('tbody').find_all('tr') if table.find('tbody') else table.find_all('tr')[1:]

        for row in rows:
            cells = row.find_all('td')
            if len(cells) < 8:
                continue

            jersey = cells[0].get_text(strip=True)
            if jersey and jersey.isdigit() and len(jersey) == 1:
                jersey = f"0{jersey}"

            raw_name = cells[2].get_text(strip=True)
            name = clean_name(raw_name)
            
            position = cells[3].get_text(strip=True)
            height = cells[4].get_text(strip=True)
            weight = cells[5].get_text(strip=True)
            dob_raw = cells[6].get_text(strip=True)
            college = cells[8].get_text(strip=True)

            dob = None
            if dob_raw:
                parts = dob_raw.split('/')
                if len(parts) == 3:
                    dob = f"{parts[2]}-{parts[0].zfill(2)}-{parts[1].zfill(2)}"

            players.append({
                "team_id": team['id'],
                "season_year": int(year),
                "player_name": name,
                "jersey_number": jersey or None,
                "position": position or None,
                "height": height or None,
                "weight": weight or None,
                "birth_date": dob,
                "college": college or None
            })

        # Remove duplicates
        unique_players = []
        seen_names = set()
        for p in players:
            key = f"{p['player_name']}-{p['team_id']}-{p['season_year']}"
            if key not in seen_names:
                unique_players.append(p)
                seen_names.add(key)

        return unique_players

    except Exception as e:
        print(f"    ❌ Error fetching {team['id']}: {e}")
        return []

def main():
    args = sys.argv[1:]
    start_year = int(args[0]) if args and args[0].isdigit() else 2026
    end_year = int(args[1]) if len(args) > 1 and args[1].isdigit() else start_year
    
    # Handle flags
    team_filter = None
    csv_file = None
    
    for arg in args:
        if arg.startswith("--csv="):
            csv_file = arg.split("=")[1]
        elif not arg.isdigit() and not arg.startswith("--"):
            team_filter = arg

    print(f"\n🏀 StatMuse NBA Seeding (Python)")
    print(f"📅 Range: {start_year} - {end_year}")
    if csv_file:
        print(f"📄 Mode: CSV Export ({csv_file})")
    else:
        print(f"🌐 Mode: Direct Supabase Upload")
    print("")

    teams_to_process = [t for t in STATMUSE_NBA_TEAMS if t['id'] == team_filter] if team_filter else STATMUSE_NBA_TEAMS

    if not teams_to_process:
        print(f"❌ Error: Team '{team_filter}' not found in mapping.")
        return

    all_scraped_players = []

    for team in teams_to_process:
        print(f"🏆 Processing {team['id'].upper()}...")
        for year in range(start_year, end_year + 1):
            print(f"  📆 Season {year}...")
            players = fetch_roster(team, year)
            
            if players:
                if csv_file:
                    all_scraped_players.extend(players)
                    print(f"    📦 Collected {len(players)} players")
                else:
                    try:
                        supabase.table("nba_rosters").upsert(players, on_conflict="team_id,season_year,player_name").execute()
                        print(f"    ✅ Saved {len(players)} players")
                    except Exception as e:
                        print(f"    ❌ DB Error: {e}")
            else:
                print(f"    ⚠️ No roster found for {year}")

            time.sleep(0.8)

    if csv_file and all_scraped_players:
        keys = all_scraped_players[0].keys()
        with open(csv_file, 'w', newline='', encoding='utf-8') as f:
            dict_writer = csv.DictWriter(f, fieldnames=keys)
            dict_writer.writeheader()
            dict_writer.writerows(all_scraped_players)
        print(f"\n💾 Successfully exported {len(all_scraped_players)} players to {csv_file}")

    print("\n✅ NBA Seeding Complete!")

if __name__ == "__main__":
    main()
