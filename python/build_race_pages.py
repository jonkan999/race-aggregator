import json
import os
import yaml
import shutil
from jinja2 import Environment, FileSystemLoader
from PIL import Image, ImageOps
import base64
import io
import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
from datetime import datetime
import subprocess

# Import the custom functions from jinja_functions.py
from jinja_functions import timeago, convert_date, slugify, get_display_values, map_verbose_distance, get_image_path

# Import the generate_sitemap function from generate_sitemap.py
from generate_sitemap import generate_sitemap_for_country

# Paths
template_dir = 'templates'
data_dir = 'data/countries'
global_data_file = 'data/global.yaml'
global_config_file = 'config/config.yaml'
build_dir = 'build'

# Set up Jinja2 environment
env = Environment(loader=FileSystemLoader(template_dir))

already_ran_file = '.git/filter-repo/already_ran'

# Add custom filters to the Jinja2 environment
env.filters['timeago'] = timeago
env.filters['convert_date'] = convert_date
env.filters['slugify'] = slugify
env.filters['map_verbose_distance'] = map_verbose_distance
env.globals['get_display_values'] = get_display_values

# Load global YAML content (used across all countries)
with open(global_data_file) as f:
    global_content = yaml.safe_load(f)

# Load config for common configurations
with open(global_config_file) as f:
    config = yaml.safe_load(f)

def clean_directory(directory, domain_name=None):
    """
    Remove files and subdirectories in the given directory.
    If domain_name is provided, only clean that specific domain folder.
    """
    if domain_name:
        # Only clean specific domain directory
        domain_path = os.path.join(directory, domain_name)
        if os.path.exists(domain_path):
            try:
                if os.path.isdir(domain_path):
                    shutil.rmtree(domain_path)
                print(f'Cleaned directory for domain: {domain_name}')
            except Exception as e:
                print(f'Failed to delete {domain_path}. Reason: {e}')
        return

    # Clean entire directory if no domain_name provided
    for filename in os.listdir(directory):
        file_path = os.path.join(directory, filename)
        try:
            if os.path.isfile(file_path) or os.path.islink(file_path):
                os.unlink(file_path)
            elif os.path.isdir(file_path):
                shutil.rmtree(file_path)
        except Exception as e:
            print(f'Failed to delete {file_path}. Reason: {e}')

def find_matching_categories(distance_str, category_mapping):
    """Find all matching categories for a given distance."""
    matching_categories = set()
    try:
        # Convert distance string to number (km)
        if distance_str.lower() == "marathon":
            distance_km = 42.2
        elif distance_str.lower() == "half marathon":
            distance_km = 21.1
        else:
            # Handle different formats (5km, 5,5km, etc)
            num_str = distance_str.lower().replace('km', '').replace(',', '.')
            distance_km = float(num_str)
        
        # Find all matching categories
        for category, config in category_mapping.items():
            if isinstance(config, dict) and 'range' in config:
                min_dist, max_dist = config['range']
                if min_dist <= distance_km <= max_dist:
                    matching_categories.add(category)
            elif config == "backyard" and distance_str.lower() == "backyard":
                matching_categories.add(category)
                
        return list(matching_categories) if matching_categories else [distance_str]
    except:
        return [distance_str]  # fallback to original if parsing fails

def generate_distance_mapping(races, verbose_mapping, category_mapping):
    """Generate a complete distance mapping from all races."""
    all_distances = set()
    
    # Collect all unique distances
    for race in races:
        if race.get('distance_verbose'):
            distances = race['distance_verbose'].split(', ')
            all_distances.update(distances)
    
    # Create the mapping dictionary
    distance_mapping = {}
    categories_used = set()
    
    for distance in sorted(all_distances):
        # First check if it's in verbose_mapping
        if distance in verbose_mapping:
            mapped_distance = verbose_mapping[distance]
        else:
            mapped_distance = distance
            
        # Find all matching categories
        categories = find_matching_categories(mapped_distance, category_mapping)
        # Only include categories that are defined in category_mapping
        valid_categories = [cat for cat in categories if cat in category_mapping]
        
        if valid_categories:  # Only add to mapping if there are valid categories
            distance_mapping[distance] = valid_categories
            categories_used.update(valid_categories)
    
    # Use category_mapping keys to maintain order
    ordered_categories = [cat for cat in category_mapping.keys() if cat in categories_used]
    
    return {
        'distance_mapping': distance_mapping,
        'available_categories': ordered_categories
    }

def is_appropriate_content(post_dict):
    """Check if post content is appropriate."""
    content = post_dict.get('content', '')
    
    # Check content length (between 1 and 500 characters)
    if not (1 <= len(content) <= 500):
        return False
    
    # List of suspicious patterns to filter out
    suspicious_patterns = [
        'http://',  # Block non-secure links
        'credit card',
        'account',
        'social security',
        'ssn',
        'paypal',
        '.ru',  # Common spam domains
        '.xyz',
        # Add more patterns as needed
    ]
    
    # Check for suspicious patterns
    content_lower = content.lower()
    for pattern in suspicious_patterns:
        if pattern in content_lower:
            return False
    
    return True

def fetch_race_wall_posts(country_code, domain_name):
    """Fetch forum posts for a specific race."""
    # Initialize Firebase Admin if not already initialized
    if not firebase_admin._apps:
        cred = credentials.Certificate('python/keys/firestore_service_account.json')
        firebase_admin.initialize_app(cred)
    
    db = firestore.client()
    
    # Query posts for this specific race
    posts = (db.collection(f'race_wall_posts_{country_code}')
             .where('source_race', '==', domain_name)
             .order_by('createdAt', direction=firestore.Query.ASCENDING)
             .get())
    
    # Convert to list of dicts and format dates, filtering out inappropriate content
    formatted_posts = []
    for post in posts:
        post_dict = post.to_dict()
        
        # Skip posts that don't meet content guidelines
        if not is_appropriate_content(post_dict):
            continue
            
        # Convert Firestore Timestamp to string
        if 'createdAt' in post_dict:
            post_dict['createdAt'] = post_dict['createdAt'].strftime('%Y-%m-%d %H:%M')
        
        formatted_posts.append(post_dict)
    
    return formatted_posts

def generate_distance_filter(country_code):
    """Generate distance filter mapping for a specific country."""
    country_dir = os.path.join(data_dir, country_code)
    
    # Load country-specific YAML content
    with open(os.path.join(country_dir, 'index.yaml')) as f:
        index_content = yaml.safe_load(f)
    
    # Load country-specific race data
    with open(os.path.join(country_dir, 'final_races.json')) as f:
        races = json.load(f)
    
    # Generate distance mapping
    mapping_data = generate_distance_mapping(
        races, 
        index_content.get('verbose_local_distance_mapping', {}),
        index_content.get('category_mapping', {})
    )
    
    # Save distance mapping to a new file
    with open(os.path.join(country_dir, 'distance_filter.yaml'), 'w', encoding='utf-8') as f:
        yaml.dump(mapping_data, f, allow_unicode=True, sort_keys=False)
    
    print(f"Distance filter generated successfully for {country_code}!")

def should_rebuild_race(race_dir, race):
    """
    Determine if a race page needs to be rebuilt by checking:
    1. If the directory exists
    2. If index.html exists
    3. If the race has images in its data
    """
    # Check if directory and index.html exist
    if not os.path.exists(race_dir) or not os.path.exists(os.path.join(race_dir, 'index.html')):
        return True
        
    # Check if race has images
    if 'images' in race and race['images']:
        # Verify that all images have firebase_url
        for image in race['images'][:4]:
            if not image.get('firebase_url'):
                return True
    
    return False

def clean_git_history_for_races(country_code, valid_domains, race_page_folder_name):
    """
    Clean Git history for race pages that are no longer included in the build.
    """
    race_pages_path = f"build/{country_code}/{race_page_folder_name}"
    
    try:
        # Get list of all race directories in Git history
        git_ls_files = subprocess.run(
            ['git', 'ls-files', race_pages_path],
            capture_output=True, text=True, check=True
        )
        existing_paths = set(git_ls_files.stdout.splitlines())
        
        # Find paths to remove (those not in valid_domains)
        paths_to_remove = set()
        for path in existing_paths:
            domain = path.split('/')[-2] if '/' in path else path  # Get domain from path
            if domain not in valid_domains:
                paths_to_remove.add(path)
        
        if paths_to_remove:
            # Check if these paths actually exist in the filesystem
            paths_that_exist = {path for path in paths_to_remove if os.path.exists(path)}
            
            if not paths_that_exist:
                print("\nNo physical files to clean from Git history.")
                return
                
            print(f"\nCleaning Git history for {len(paths_that_exist)} outdated race paths...")
            
            # Create temporary file with paths to remove
            with open('paths_to_remove.txt', 'w') as f:
                for path in paths_that_exist:
                    f.write(f"{path}\n")
            
            # Remove the already_ran file if it exists
            if os.path.exists(already_ran_file):
                os.remove(already_ran_file)
            
            # Use git filter-repo to remove these paths from history
            subprocess.run([
                'git', 'filter-repo',
                '--paths-from-file', 'paths_to_remove.txt',
                '--invert-paths',
                '--force'
            ], check=True)
            
            # Clean up temporary file
            os.remove('paths_to_remove.txt')
            
            print("Git history cleaned successfully!")
            
            # Remind about force push
            print("\nNOTE: You will need to force push these changes:")
            print("git push origin --force --all")
        else:
            print("\nNo outdated race paths found in Git history.")
            
    except subprocess.CalledProcessError as e:
        print(f"Error during Git cleanup: {e}")
    except Exception as e:
        print(f"Unexpected error during Git cleanup: {e}")

def generate_race_pages(country_code, domain_name=None, rebuild_all=False):
    """
    Generate race pages for a country. If domain_name is provided,
    only generate the page for that specific race.
    rebuild_all forces rebuild of all pages regardless of current state.
    """
    # First generate the distance filter (only if building all races)
    if not domain_name:
        generate_distance_filter(country_code)
    
    country_dir = os.path.join(data_dir, country_code)
    
    # Load country-specific YAML content
    with open(os.path.join(country_dir, 'index.yaml')) as f:
        index_content = yaml.safe_load(f)
    
    # Load country-specific race data
    with open(os.path.join(country_dir, 'final_races.json')) as f:
        all_races = json.load(f)
    
    # Filter races if domain_name is provided
    races = [race for race in all_races if race['domain_name'] == domain_name] if domain_name else all_races
    
    if domain_name and not races:
        print(f"No race found with domain name: {domain_name}")
        return

    # Get valid domains for this build
    valid_domains = {race['domain_name'] for race in races}

    # If building all races, clean up Git history for outdated races
    if not domain_name:
        clean_git_history_for_races(
            country_code, 
            valid_domains, 
            index_content['race_page_folder_name']
        )

    # Merge global content with country-specific content
    content = {**global_content, **index_content}

    # Create build directory
    country_build_dir = os.path.join(build_dir, country_code, content['race_page_folder_name'])
    os.makedirs(country_build_dir, exist_ok=True)

    # Load templates
    race_page = env.get_template('race_page.html')
    race_page_content = env.get_template('sections/race-page-content.html')

    # Track statistics
    total_races = len(races)
    skipped_races = 0
    built_races = 0

    for race in races:
        race_dir = os.path.join(country_build_dir, race['domain_name'])
        
        # Check if we need to rebuild this race page
        if not rebuild_all and not should_rebuild_race(race_dir, race):
            print(f"Skipping {race['name']} - already built")
            skipped_races += 1
            continue

        print(f"\n############ Building race: {race['name']} ############")
        
        # Create race-specific directory
        os.makedirs(race_dir, exist_ok=True)

        # Get images directly from race data
        race_images = []
        if 'images' in race:
            for image in race['images'][:4]:  # Limit to first 4 images
                race_images.append({
                    'firebase_url': image['firebase_url'],
                    'alt': image['alt_text']
                })
        
        # Fetch forum posts for this race
        race_wall_posts = fetch_race_wall_posts(country_code, race['domain_name'])
        
        # Create meta description using first 2 sentences of description
        if race['description']:
            sentences = race['description'].split('.')
            if len(sentences) > 1:
                meta_description = f"{sentences[0]}. {sentences[1]}."
            else:
                meta_description = race['description']
        else:
            meta_description = f"{race['name']} - {race['distance_verbose']}"
        
        # Prepare the context for rendering
        context = {
            **content,
            'race': race,
            'images': race_images,
            'css_path': '/css',
            'js_path': '/js',
            'race_date': convert_date(race['date'], content['month_mapping_short']),
            'mapbox_zoom': content['mapbox_zoom'],
            'race_wall_posts': race_wall_posts,
            'meta_description': meta_description,
            'get_image_path': get_image_path
        }

        # Render the race page content
        race_content = race_page_content.render(context)

        # Render the full page
        full_page = race_page.render({**context, 'race_content': race_content})

        # Save the rendered HTML
        with open(os.path.join(race_dir, 'index.html'), 'w', encoding='utf-8') as f:
            f.write(full_page)
            
        built_races += 1

    print(f"\nBuild statistics for {country_code}:")
    print(f"Total races: {total_races}")
    print(f"Skipped (already built): {skipped_races}")
    print(f"Newly built: {built_races}")

    # Generate sitemap after race pages are created
    generate_sitemap_for_country(country_code)

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Generate race pages')
    parser.add_argument('--country', '-c', type=str, default='se', help='Country code (default: se)')
    parser.add_argument('domain', nargs='?', help='Specific domain name to generate (optional)')
    parser.add_argument('--filter', '-f', action='store_true', help='Generate distance filter only')
    parser.add_argument('--rebuild-all', '-r', action='store_true', help='Force rebuild of all pages')
    
    args = parser.parse_args()
    country_code = args.country.lower()
    
    if args.filter:
        # Generate distance filter only
        generate_distance_filter(country_code)
    elif args.domain:
        # Generate specific race page
        generate_race_pages(country_code, args.domain, args.rebuild_all)
    else:
        # Generate all race pages
        generate_race_pages(country_code, None, args.rebuild_all)

""" # Examples of usage:
# Generate all race pages for Sweden (default)
python build_race_pages.py

# Generate all race pages for Sweden and force rebuild all
python build_race_pages.py --rebuild-all

# Generate all race pages for Norway and force rebuild all
python build_race_pages.py --country no --rebuild-all

# Generate specific race page for Sweden and force rebuild
python build_race_pages.py ultravasan-90 --rebuild-all

# Generate specific race page for Norway and force rebuild
python build_race_pages.py --country no holmenkollmarsjen --rebuild-all

# Generate distance filter for Sweden
python build_race_pages.py --filter

# Generate distance filter for Norway
python build_race_pages.py --country no --filter
"""