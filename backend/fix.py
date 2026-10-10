import os, glob

files = glob.glob('frontend/src/pages/*.tsx')
for f in files:
    with open(f, 'r', encoding='utf-8') as fp:
        content = fp.read()
    
    # Fix the literal backslashes
    content = content.replace("\\'", "'")
    
    # apiFetch directly returns JSON now!
    # I need to change:
    # const res = await apiFetch('alerts');
    # if (!res.ok) throw new Error('Failed to fetch alerts');
    # const result = await res.json();
    # setAlerts(result);
    # TO:
    # const result = await apiFetch('alerts');
    # setAlerts(result);
    
    import re
    # Remove: const res = await apiFetch(...)
    # if (!res.ok) throw new Error(...)
    # const result = await res.json()
    
    # This is a bit complex for a simple replace. Let's just fix the backslashes first to make it valid TS, then I'll use multi_replace for each file.
    
    with open(f, 'w', encoding='utf-8') as fp:
        fp.write(content)
