#!/usr/bin/env python3
"""
NHL StatMuse Roster Seeder (Python Version)
Scrapes NHL roster data from StatMuse and saves to Supabase.

Usage: 
    python3 scripts/seed_nhl_statmuse.py [year] [team_id]
    Year defaults to 2025.
    Team ID is optional (e.g., 'tampa-bay-lightning').

Installation:
    pip install requests beautifulsoup4 supabase python-dotenv
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

# NHL Team Mapping (Same as TS version)
STATMUSE_NHL_TEAMS = [
    {"id": "anaheim-ducks", "slug": "anaheim-ducks", "statmuseId": 32},
    {"id": "boston-bruins", "slug": "boston-bruins", "statmuseId": 6},
    {"id": "buffalo-sabres", "slug": "buffalo-sabres", "statmuseId": 19},
    {"id": "calgary-flames", "slug": "calgary-flames", "statmuseId": 21},
    {"id": "carolina-hurricanes", "slug": "carolina-hurricanes", "statmuseId": 26},
    {"id": "chicago-blackhawks", "slug": "chicago-blackhawks", "statmuseId": 11},
    {"id": "colorado-avalanche", "slug": "colorado-avalanche", "statmuseId": 27},
    {"id": "columbus-blue-jackets", "slug": "columbus-blue-jackets", "statmuseId": 36},
    {"id": "dallas-stars", "slug": "dallas-stars", "statmuseId": 15},
    {"id": "detroit-red-wings", "slug": "detroit-red-wings", "statmuseId": 12},
    {"id": "edmonton-oilers", "slug": "edmonton-oilers", "statmuseId": 25},
    {"id": "florida-panthers", "slug": "florida-panthers", "statmuseId": 33},
    {"id": "los-angeles-kings", "slug": "los-angeles-kings", "statmuseId": 14},
    {"id": "minnesota-wild", "slug": "minnesota-wild", "statmuseId": 37},
    {"id": "montreal-canadiens", "slug": "montreal-canadiens", "statmuseId": 1},
    {"id": "nashville-predators", "slug": "nashville-predators", "statmuseId": 34},
    {"id": "new-jersey-devils", "slug": "new-jersey-devils", "statmuseId": 23},
    {"id": "new-york-islanders", "slug": "new-york-islanders", "statmuseId": 22},
    {"id": "new-york-rangers", "slug": "new-york-rangers", "statmuseId": 10},
    {"id": "ottawa-senators", "slug": "ottawa-senators", "statmuseId": 30},
    {"id": "philadelphia-flyers", "slug": "philadelphia-flyers", "statmuseId": 16},
    {"id": "pittsburgh-penguins", "slug": "pittsburgh-penguins", "statmuseId": 17},
    {"id": "san-jose-sharks", "slug": "san-jose-sharks", "statmuseId": 29},
    {"id": "seattle-kraken", "slug": "seattle-kraken", "statmuseId": 39},
    {"id": "st-louis-blues", "slug": "st-louis-blues", "statmuseId": 18},
    {"id": "tampa-bay-lightning", "slug": "tampa-bay-lightning", "statmuseId": 31},
    {"id": "toronto-maple-leafs", "slug": "toronto-maple-leafs", "statmuseId": 5},
    {"id": "utah-hockey-club", "slug": "utah-hockey-club", "statmuseId": 40},
    {"id": "vancouver-canucks", "slug": "vancouver-canucks", "statmuseId": 20},
    {"id": "vegas-golden-knights", "slug": "vegas-golden-knights", "statmuseId": 38},
    {"id": "washington-capitals", "slug": "washington-capitals", "statmuseId": 24},
    {"id": "winnipeg-jets", "slug": "winnipeg-jets", "statmuseId": 35}
]

def clean_name(name):
    """
    Cleans StatMuse name formatting (strips redundant abbreviation).
    Example: 'Cam Atkinson C. Atkinson' -> 'Cam Atkinson'
    """
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
    slug = team['slug']
    
    # Dynamic slug handling for Utah
    if team['id'] == "utah-hockey-club":
        slug = "utah-mammoth" if year >= 2026 else "utah-hockey-club"

    url = f"https://www.statmuse.com/nhl/team/{slug}-{team['statmuseId']}/roster/{year}"
    
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
            # Pad jersey number (1 -> 01)
            if jersey and jersey.isdigit() and len(jersey) == 1:
                jersey = f"0{jersey}"

            raw_name = cells[2].get_text(strip=True)
            name = clean_name(raw_name)
            
            position = cells[3].get_text(strip=True)
            height = cells[4].get_text(strip=True)
            weight = cells[5].get_text(strip=True)
            dob_raw = cells[6].get_text(strip=True)
            birthplace = cells[8].get_text(strip=True)

            # Basic DOB parsing (MM/DD/YYYY to YYYY-MM-DD)
            dob = None
            if dob_raw:
                parts = dob_raw.split('/')
                if len(parts) == 3:
                    dob = f"{parts[2]}-{parts[0].zfill(2)}-{parts[1].zfill(2)}"

            players.append({
                "team_id": team['id'],
                "season_year": year,
                "player_name": name,
                "jersey_number": jersey or None,
                "position": position or None,
                "height": height or None,
                "weight": weight or None,
                "birth_date": dob,
                "birthplace": birthplace or None
            })

        # Remove duplicates within the batch
        unique_players = []
        seen_names = set()
        for p in players:
            if p['player_name'] not in seen_names:
                unique_players.append(p)
                seen_names.add(p['player_name'])

        return unique_players

    except Exception as e:
        print(f"    ❌ Error fetching {team['id']}: {e}")
        return []

def main():
    args = sys.argv[1:]
    start_year = int(args[0]) if args and args[0].isdigit() else 2025
    end_year = int(args[1]) if len(args) > 1 and args[1].isdigit() else start_year
    
    # Handle flags
    team_filter = None
    csv_file = None
    
    for arg in args:
        if arg.startswith("--csv="):
            csv_file = arg.split("=")[1]
        elif not arg.isdigit() and not arg.startswith("--"):
            team_filter = arg

    print(f"\n🏒 StatMuse NHL Seeding (Python)")
    print(f"📅 Range: {start_year} - {end_year}")
    if csv_file:
        print(f"📄 Mode: CSV Export ({csv_file})")
    else:
        print(f"🌐 Mode: Direct Supabase Upload")
    print("")

    teams_to_process = [t for t in STATMUSE_NHL_TEAMS if t['id'] == team_filter] if team_filter else STATMUSE_NHL_TEAMS

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
                        # Upsert to Supabase
                        supabase.table("nhl_rosters").upsert(players, on_conflict="team_id,season_year,player_name").execute()
                        print(f"    ✅ Saved {len(players)} players")
                    except Exception as e:
                        print(f"    ❌ DB Error: {e}")
            else:
                print(f"    ⚠️ No roster found for {year}")

            # Rate limiting benefit
            time.sleep(0.8)

    if csv_file and all_scraped_players:
        keys = all_scraped_players[0].keys()
        with open(csv_file, 'w', newline='', encoding='utf-8') as f:
            dict_writer = csv.DictWriter(f, fieldnames=keys)
            dict_writer.writeheader()
            dict_writer.writerows(all_scraped_players)
        print(f"\n💾 Successfully exported {len(all_scraped_players)} players to {csv_file}")

    print("\n✅ NHL Seeding Complete!")

if __name__ == "__main__":
    main()
