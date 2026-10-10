import sqlite3
conn = sqlite3.connect('backend/greenwave.db')
c = conn.cursor()
c.execute('UPDATE users SET role = "DISTRICT_OFFICER" WHERE role = "district_officer"')
c.execute('UPDATE users SET role = "GLOBAL_ADMIN" WHERE role = "global_admin"')
conn.commit()
print('Fixed user roles!')
