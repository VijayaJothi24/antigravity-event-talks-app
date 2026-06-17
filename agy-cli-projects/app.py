import os
import re
# pyrefly: ignore [missing-import]
import requests
import xml.etree.ElementTree as ET
# pyrefly: ignore [missing-import]
from flask import Flask, jsonify, render_template

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

def parse_release_notes():
    try:
        response = requests.get(FEED_URL, timeout=10)
        response.raise_for_status()
        xml_data = response.content
    except Exception as e:
        print(f"Error fetching feed: {e}")
        return []

    try:
        ns = {'atom': 'http://www.w3.org/2005/Atom'}
        root = ET.fromstring(xml_data)
        
        updates = []
        for entry in root.findall('atom:entry', ns):
            # The title is the date in the XML (e.g. "June 15, 2026")
            title_elem = entry.find('atom:title', ns)
            date_str = title_elem.text.strip() if title_elem is not None else "Unknown Date"
            
            # The updated timestamp
            updated_elem = entry.find('atom:updated', ns)
            updated_str = updated_elem.text if updated_elem is not None else ""
            
            # The link
            link_elem = entry.find("atom:link[@rel='alternate']", ns)
            if link_elem is None:
                link_elem = entry.find("atom:link", ns)
            link_str = link_elem.attrib.get('href', '') if link_elem is not None else ""
            
            # Get the content text (the HTML content of the entry)
            content_elem = entry.find('atom:content', ns)
            if content_elem is None or content_elem.text is None:
                continue
                
            content_html = content_elem.text.strip()
            
            # Parse the content html to extract individual updates.
            # Each update starts with an <h3> element describing the type (Feature, Issue, etc.),
            # followed by the description (usually <p> and sometimes <ul>).
            # We use a regex to capture each <h3>...</h3> block and everything following it up to the next <h3> or end.
            matches = re.findall(r'<h3>([^<]+)</h3>\s*(.*?)(?=\s*<h3>|$)', content_html, re.DOTALL)
            
            # If no <h3> tags are found, treat the entire entry as a single 'Announcement'
            if not matches:
                clean_text = re.sub(r'<[^<]+?>', '', content_html).strip()
                clean_text = re.sub(r'\s+', ' ', clean_text)
                
                entry_id_elem = entry.find('atom:id', ns)
                entry_id = entry_id_elem.text.strip() if entry_id_elem is not None else "id"
                
                updates.append({
                    'id': f"{entry_id}_0",
                    'date': date_str,
                    'raw_date': updated_str,
                    'type': 'Announcement',
                    'html': content_html,
                    'text': clean_text,
                    'link': link_str
                })
            else:
                entry_id_elem = entry.find('atom:id', ns)
                entry_id = entry_id_elem.text.strip() if entry_id_elem is not None else "id"
                
                for idx, (update_type, update_html) in enumerate(matches):
                    update_type = update_type.strip()
                    update_html = update_html.strip()
                    
                    # Clean the HTML tags to create a text-only summary for tweeting/previews
                    clean_text = re.sub(r'<[^<]+?>', '', update_html).strip()
                    clean_text = re.sub(r'\s+', ' ', clean_text)
                    
                    item_id = f"{entry_id}_{idx}"
                    
                    updates.append({
                        'id': item_id,
                        'date': date_str,
                        'raw_date': updated_str,
                        'type': update_type,
                        'html': update_html,
                        'text': clean_text,
                        'link': link_str
                    })
                    
        return updates
    except Exception as e:
        print(f"Error parsing feed XML: {e}")
        return []

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/release-notes')
def get_release_notes():
    notes = parse_release_notes()
    return jsonify(notes)

if __name__ == '__main__':
    # Running on local port 5000
    app.run(debug=True, port=5000)
