import re

path = "android/app/build.gradle"
with open(path) as f:
    content = f.read()

release_block = (
    '        release {\n'
    '            storeFile file(System.getenv("B24_UPLOAD_STORE_FILE"))\n'
    '            storePassword System.getenv("B24_UPLOAD_STORE_PASSWORD")\n'
    '            keyAlias System.getenv("B24_UPLOAD_KEY_ALIAS")\n'
    '            keyPassword System.getenv("B24_UPLOAD_KEY_PASSWORD")\n'
    '        }\n'
)

content = re.sub(r'(signingConfigs\s*\{)', r'\1\n' + release_block, content, count=1)
content = re.sub(r'signingConfig signingConfigs\.debug', 'signingConfig signingConfigs.release', content, count=1)

with open(path, "w") as f:
    f.write(content)

print("build.gradle patched successfully")
