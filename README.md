# Vacation Days

This work-in-progress application is a simple anonymous kban board to make a simple "event planner" for the day-to-day of a vacation.

## MVO

- Realtime - application will likely use websockets to keep data in sync with other users
- Ideally, no database, but probably something like mongodb
- On connection, prompted simple shared phrase/password to access that specific workboard
- Events should be saved under the workboard
- Should retain session for one week
- Top right should have the ability to "change workboard" resetting session and presenting for new phrase
- Columns should be each day (Monday, Tuesday, Wednesday)

## Docker Compose
```
YES EVENTUALLY
```

## Further Ideas
- Create "user"
- Assign "users" to events, in example: Concert -> Alice,Bob,Charlie
- Users should be colorized by hash of name declared
- Colorize events to present or auto-hash colors?
- Create a date range and automatically add in columns for each day
- New Columns should map to a day of the month
- Create "Other" for catch-all


# Inspiration
- Dumbkan - <https://github.com/DumbWareio/DumbKan>
