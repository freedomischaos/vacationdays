# Vacation Days

This work-in-progress application is a simple anonymous kban board to make a simple "event planner" for the day-to-day of a vacation. To be shared with all members to more easily know what is happening that day or chore lists, etc. It mostly works.

This was created with assistance from an LLM. I'm not a web-developer, and would have spent many more weeks putting it together than a long-ish weekend. This did however help me understand a lot in development in general, so I'm taking it as a win regardless.

There be bugs probably? I imagine this doesn't not scale well with dozens and dozens of users, but in testing everything seemed pretty fast. Probably security issues or maybe a disk issue if someone got in and just created a lot of data in the json file. The api might reveal boards that exist when they are updated.

Design is intended to be temporary with some minor security by obscurity practices, but with quality of life as primary intent.

## MVO

- Realtime-ish - application will likely use websockets to keep data in sync with other users
- Ideally, no database. Filesystem based. JSON for data.
- On connection, prompted simple shared boardname to access that specific workboard
- URI to support direct to board with workboard declared as "/<workboard>/"
- Events should be saved under the workboard as a unique json file
- Top right should have the ability to "Add Workboard" resetting session and presenting for new boardname
- Columns should be each day (Monday, Tuesday, Wednesday)

## Docker Compose
```
YES EVENTUALLY
```

## Further Ideas
- Create pseudo-"user"
- Assign "users" to "tasks", in example: Concert -> Alice,Bob,Charlie
- Users should be colorized by hash of name declared
- Colorize events to present or auto-hash colors?
- Create "Description" for catch-all, at the top of the page
- Better naming for things?

# Inspiration and Fork
- Dumbkan - <https://github.com/DumbWareio/DumbKan>
