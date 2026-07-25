# Processing Common Crawl data
import warc
from warcio.archiveiterator import ArchiveIterator

def process_common_crawl(warc_path):
    with open(warc_path, 'rb') as stream:
        for record in ArchiveIterator(stream):
            if record.rec_type == 'response':
                # Extract URL
                url = record.rec_headers.get_header('WARC-Target-URI')

                # Get content
                content = record.content_stream().read()

                # Extract text from HTML
                text = extract_text_from_html(content)

                # Apply quality filters
                if passes_quality_checks(text):
                    yield {
                        'url': url,
                        'text': text,
                        'length': len(text)
                    }
