import os
import re
import unicodedata
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

url = os.environ.get("VITE_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

def clean_name(name):
    if not name:
        return name
    # Remove diacritics/accents
    name = unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode('ascii')
    
    # Handle StatMuse name redundancy (e.g., "Ryan BurrR. Burr" or "Charles Alexis Legault C. Alexis Legault")
    match = re.search(r"(.+?)\s?([A-Z]\. .+)$", name)
    if match:
        full_name, abbrev = match.groups()
        full_name = full_name.strip()
        abbrev = abbrev.strip()
        initial = abbrev[0]
        last_name_part = abbrev[3:].strip()
        if full_name.startswith(initial) and full_name.endswith(last_name_part):
            return full_name

    parts = name.split()
    if len(parts) >= 3:
        # Check for patterns like "James van Riemsdyk J. van Riemsdyk"
        # Join the last N parts and see if they match the start
        for i in range(1, len(parts)//2 + 1):
            potential_abbrev = " ".join(parts[-i-1:])
            if "." in parts[-i-1] and len(parts[-i-1]) == 2:
                last_name_part = " ".join(parts[-i:])
                full_name_candidate = " ".join(parts[:-i-1])
                if full_name_candidate.endswith(last_name_part):
                    return full_name_candidate
            
    return name

def cleanup_table(table_name):
    print(f"\n🧹 Cleaning up table: {table_name}")
    
    # Fetch all records with pagination
    all_records = []
    page_size = 1000
    current_page = 0
    while True:
        start = current_page * page_size
        end = start + page_size - 1
        response = supabase.table(table_name).select("*").order("id").range(start, end).execute()
        page_records = response.data
        if not page_records:
            break
        all_records.extend(page_records)
        if len(page_records) < page_size:
            break
        current_page += 1
        print(f"  Fetched {len(all_records)} records...")

    records = all_records
    print(f"  Total records fetched: {len(records)}")
    
    # Build a lookup for existing clean names: (team_id, season_year, player_name) -> id
    lookup = {}
    for r in records:
        key = (r.get("team_id"), r.get("season_year"), r.get("player_name"))
        lookup[key] = r["id"]

    updates = []
    deletes = []
    skipped_nhl = 0
    
    for record in records:
        original_name = record["player_name"]
        cleaned_name = clean_name(original_name)
        
        # Jersey Padding Logic
        original_jersey = record.get("jersey_number")
        cleaned_jersey = original_jersey
        if original_jersey and original_jersey.isdigit() and len(original_jersey) == 1:
            cleaned_jersey = f"0{original_jersey}"
            
        if cleaned_name != original_name or cleaned_jersey != original_jersey:
            # Check if cleaning would cause a duplicate (mostly for name changes)
            new_key = (record.get("team_id"), record.get("season_year"), cleaned_name)
            if cleaned_name != original_name and new_key in lookup and lookup[new_key] != record["id"]:
                # Conflict! Delete this record instead of updating
                deletes.append(record["id"])
            else:
                record["player_name"] = cleaned_name
                record["jersey_number"] = cleaned_jersey
                updates.append(record)
                # Update lookup so we don't accidentally create another conflict or double-update
                if (record.get("team_id"), record.get("season_year"), original_name) in lookup:
                    del lookup[(record.get("team_id"), record.get("season_year"), original_name)]
                lookup[new_key] = record["id"]
        elif table_name == "nhl_rosters" and ". " in original_name:
            skipped_nhl += 1
            if skipped_nhl <= 10:
                print(f"  [DEBUG] NHL name NOT cleaned: '{original_name}'")
    
    if table_name == "nhl_rosters":
        print(f"  [SUMMARY] NHL: {len(updates)} updates, {len(deletes)} deletes, {skipped_nhl} skipped patterns.")

    if deletes:
        print(f"🗑️ Deleting {len(deletes)} duplicate records...")
        for i in range(0, len(deletes), 100):
            supabase.table(table_name).delete().in_("id", deletes[i:i+100]).execute()
            print(f"  Deleted chunk {i//100 + 1}/{(len(deletes)-1)//100 + 1}")

    if updates:
        print(f"🚀 Updating {len(updates)} records in {table_name}...")
        for i in range(0, len(updates), 1000):
            supabase.table(table_name).upsert(updates[i:i+1000]).execute()
            print(f"  Uploaded chunk {i//1000 + 1}/{(len(updates)-1)//1000 + 1}")
    else:
        print(f"✅ No records left to update in {table_name}")

if __name__ == "__main__":
    tables = ["mlb_rosters", "nhl_rosters", "nba_rosters"]
    for table in tables:
        cleanup_table(table)
    print("\n✨ Database cleanup complete!")
