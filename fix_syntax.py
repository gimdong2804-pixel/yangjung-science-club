import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the junk from line 3727:
# }; font-size: 1.1rem; margin-right: 0.3rem; font-weight: bold; line-height: 1; letter-spacing: -2px;">${arrows}</span>`;
content = re.sub(r'\};\s*font-size: 1\.1rem; margin-right: 0\.3rem; font-weight: bold; line-height: 1; letter-spacing: -2px;">\$\{arrows\}</span>`;', '}', content)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)
