#!/usr/bin/env python3
"""
MLB StatMuse Roster Seeder (Python Version)
Scrapes MLB roster data from StatMuse and saves to Supabase.

Usage: 
    python3 scripts/seed_mlb_statmuse.py [startYear] [endYear] [team_id]
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

# MLB Team Mapping
STATMUSE_MLB_TEAMS = [
  {"id": "arizona-diamondbacks", "slug": "arizona-diamondbacks", "statmuseId": 97},
  {"id": "atlanta-braves", "slug": "atlanta-braves", "statmuseId": 1},
  {"id": "baltimore-orioles", "slug": "baltimore-orioles", "statmuseId": 73},
  {"id": "boston-red-sox", "slug": "boston-red-sox", "statmuseId": 69},
  {"id": "chicago-cubs", "slug": "chicago-cubs", "statmuseId": 2},
  {"id": "chicago-white-sox", "slug": "chicago-white-sox", "statmuseId": 70},
  {"id": "cincinnati-reds", "slug": "cincinnati-reds", "statmuseId": 19},
  {"id": "cleveland-guardians", "slug": "cleveland-guardians", "statmuseId": 71},
  {"id": "colorado-rockies", "slug": "colorado-rockies", "statmuseId": 95},
  {"id": "detroit-tigers", "slug": "detroit-tigers", "statmuseId": 72},
  {"id": "houston-astros", "slug": "houston-astros", "statmuseId": 87},
  {"id": "kansas-city-royals", "slug": "kansas-city-royals", "statmuseId": 89},
  {"id": "los-angeles-angels", "slug": "los-angeles-angels", "statmuseId": 85},
  {"id": "los-angeles-dodgers", "slug": "los-angeles-dodgers", "statmuseId": 31},
  {"id": "miami-marlins", "slug": "miami-marlins", "statmuseId": 96},
  {"id": "milwaukee-brewers", "slug": "milwaukee-brewers", "statmuseId": 92},
  {"id": "minnesota-twins", "slug": "minnesota-twins", "statmuseId": 75},
  {"id": "new-york-mets", "slug": "new-york-mets", "statmuseId": 88},
  {"id": "new-york-yankees", "slug": "new-york-yankees", "statmuseId": 76},
  {"id": "oakland-athletics", "slug": "oakland-athletics", "statmuseId": 74},
  {"id": "philadelphia-phillies", "slug": "philadelphia-phillies", "statmuseId": 27},
  {"id": "pittsburgh-pirates", "slug": "pittsburgh-pirates", "statmuseId": 22},
  {"id": "san-diego-padres", "slug": "san-diego-padres", "statmuseId": 91},
  {"id": "san-francisco-giants", "slug": "san-francisco-giants", "statmuseId": 25},
  {"id": "seattle-mariners", "slug": "seattle-mariners", "statmuseId": 93},
  {"id": "st-louis-cardinals", "slug": "st-louis-cardinals", "statmuseId": 67},
  {"id": "tampa-bay-rays", "slug": "tampa-bay-rays", "statmuseId": 98},
  {"id": "texas-rangers", "slug": "texas-rangers", "statmuseId": 86},
  {"id": "toronto-blue-jays", "slug": "toronto-blue-jays", "statmuseId": 94},
  {"id": "washington-nationals", "slug": "washington-nationals", "statmuseId": 90}
]

def clean_name(name):
    # Remove diacritics/accents
    name = unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode('ascii')
    
    # Handle StatMuse name redundancy (e.g., "Ryan BurrR. Burr" or "Dominick BarlowD. Barlow")
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
    url = f"https://www.statmuse.com/mlb/team/{team['slug']}-{team['statmuseId']}/roster/{year}"
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
            birthplace = cells[8].get_text(strip=True)

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

        # Remove duplicates
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

    print(f"\n⚾ StatMuse MLB Seeding (Python)")
    print(f"📅 Range: {start_year} - {end_year}")
    if csv_file:
        print(f"📄 Mode: CSV Export ({csv_file})")
    else:
        print(f"🌐 Mode: Direct Supabase Upload")
    print("")

    teams_to_process = [t for t in STATMUSE_MLB_TEAMS if t['id'] == team_filter] if team_filter else STATMUSE_MLB_TEAMS

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
                        supabase.table("mlb_rosters").upsert(players, on_conflict="team_id,season_year,player_name").execute()
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

    print("\n✅ MLB Seeding Complete!")

if __name__ == "__main__":
    main()
