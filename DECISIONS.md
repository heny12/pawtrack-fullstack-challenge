# Full-Stack Engineering Decisions

## Audit Findings
<!-- For each issue you find, document:
     - What the issue is and which file it's in
     - Why it matters (security risk, data integrity, UX impact)
     - Severity (critical / high / medium / low)
     - How you fixed it (fill this in during Phase 2) -->
| priority | location | issue | why it matters 
|--|--|--|--|
| low | app.js | API_BASE hard coded to localhost | moving this to environment variables will make this flexible enough to run in different environments, on different ports, and with https. For now this is fine for development purposes. |
| medium | types/index.ts Sitter type | sitter is scoped to single tenant | if a sitter wants to sit for multiple tenants we will need to create another sitters entity for the same sitter, denormalizing our data |
| low | types/index.ts Booking type | booking history not persisted | status maintained as attribute on booking records, this works fine but does not provide us a history of status (or other attribute) changes which can be helpful for data analytics and debugging. The event bus somewhat addresses this but in my opinion a persisted log would be better. |
| critical | bookings.ts GET /api/bookings | tenantId may be overridden regardless of clients role | any client may override their respective auth tenantId by setting the tenantId query parameter to that of another tenant. This is a critical security risk. |
| critical | bookings.ts GET /api/bookings/:id | no tenant access control | any client may query any booking id regardless of their tentant. This is also a critical security concern of leaking data across tenants. |
| high | bookings.ts GET /api/bookings/:id | no sitter access control | the is no access control preventing sitters from requesting other sitters bookings. This can be a security concern depending on whether this API is publicly available and how the web server calls this. |
| high | bookings.ts | inappropriate error codes returned | this api does a poor job returning descriptive HTTP error codes on failures, in some cases returned 200s as catch-all error cases. |
| medium | intex/type.ts | no owner model | pet owners are going to be one of the primary users within our system and should be represented in the data model. Right now we store some owner data in the pet type which risks being inconsistent with owners who have multiple pets. |
| low | bookings.ts PATCH /api/bookings/:id/status | non RESTful route | route is not purely RESTful and only updates the status field. This itself is not a huge issue but it is likely that our system will require updates to other fields such as notes, in this case a single update route would be preferable many update routes. |
| high | pets.ts GET /api/pets | no pet access control | clients of this endpoint will receive all pets for their respective tenant, regardless of their role. For admin and sitters this may be acceptable but we may wish to restrict this for owners. |
| medium | pets.ts GET /api/sitters | api serves multiple resources | it would be better practice to create a new sitters.ts routes file to serve this route. |
| low | booking-service.ts | open queries to booking datastore | multiple places in the booking service have open queries to the booking store, then filter or apply pagination on top of that. This works on a small scale but will quickly slow down the api servers and add unnecessary memory/cpu pressure to our apis and dbs as the data size increases.  |
| medium | booking-service.ts | uncaught event bus calls | calls to the event bus should be wrapped in try/catch. Since these are non-critical operations they should not result in bad api responses, especially when bookings have been created and there is no rollback strategy. |
| critical | booking-service.ts | booking access control | booking service allows client to create booking with tenants that do not belong to the specified tenantId, validation should prevent this from happening. |
| high | booking-service.ts | booking creation race condition | since there is latency between validation and creation of our booking object and our datastore does not enforce uniqueness we can have situations where multiple sitters get assigned to the same pet at the same time |
| | | | |

## API Design
<!-- What changes did you make to the API?
     - Status codes, validation, error responses
     - Any conventions you followed (REST, JSON:API, RFC 7807)
     - How would this API evolve for production? -->

 - I added more tenant scoped calls to the api to ensure that it does not expose data from other tenant or allow unauthorized data CRUD
 - I added logic to ensure only admins may override the tenant queried for bookings, this is a critical security restriction to have
 - I split the `GET /api/sitters` function into a separate route file specifically for this sitter resource. Not a critical change, but quick and easy
 - I wrapped the event bus calls in try/catch blocks to ensure this non-critical operation did not prevent a successful response code from being returned
 - I would have liked to also improve the reponse codes returned from the api, especially for error cases. For purpose of this exercise since the api is only called by an admin dashboard I decided to deprioritize this fix.

With the lack of a proper testing framework I validated some of the important user interactions with manual curl requests:

 - User can list all their respective tenant bookings: 
	 - curl -H "X-Tenant-Id: tenant_portland" -H "X-User-Id: user_staff_portland"  "http://localhost:3001/api/bookings?page=1&limit=100"
 - Admins can list all bookings:
	 - curl -H "X-User-Role: admin" -H "X-Tenant-Id: tenant_portland" -H "X-User-Id: user_staff_portland"  "http://localhost:3001/api/bookings?page=1&limit=100&"
	 - curl -H "X-User-Role: admin" -H "X-Tenant-Id: tenant_seattle" -H "X-User-Id: user_staff_portland"  "http://localhost:3001/api/bookings?page=1&limit=100&"
 - User can access booking in there tenancy
	 - curl -H "X-Tenant-Id: tenant_portland" -H "X-User-Id: user_staff_portland"  "http://localhost:3001/api/bookings/booking_001"
 - User cannot access booking not in there tenancy
	 - curl -H "X-Tenant-Id: tenant_portland" -H "X-User-Id: user_staff_portland"  "http://localhost:3001/api/bookings/booking_007"

## Architecture Observations
<!-- What patterns or anti-patterns did you see?
     - How is business logic organized?
     - What would you change about the data model or service layer?
     - How does this map to DDD or clean architecture? -->
 
 - The data model was pretty good but could be improved to better represent all of the domain entities/relations. The most important one that I noticed was that there was no domain entity for PetOwner. Also I found that  the term "user" was used across the codebase which was confusing as there are various users of this system (Sitter, Owner, Staff, Admin).
 - Multi-tenancy was not handled well within this app. There was not a clear separation of this data in the datastore which made handling separation and authorization of data in the api/service layer messy and error prone. For this reason I prioritized fixing this issue over other api and frontend issues.
 - While business logic was fairly well consolidated in the service layer there were a few places where business logic was leaked into the API route layer and the Type layer.
 - The service layer could also use more request validation to handle bad data requests.
 - Overall I thought the structure of project between the frontend, backend, middleware, routes, services, types, and data store was good which made navigation of the project easier. 
 - There was a good level of comments too.

## Frontend Approach
<!-- What changes did you make to the frontend?
     - State management approach
     - Error handling strategy
     - Any framework you would use in production and why -->
Due to the existing architectural and backend changes and time limitations I chose to deprioritize frontend changes. With this being a simple admin dashboard and not customer facing I decided to focus instead on issues impacting the security and integrity of the system.

## Improvement Implemented
<!-- Which improvement did you choose to implement and why?
     Why did you prioritize this one over others? -->
Most of the changes I implemented were around multitenancy improvements. This included scoping user interactions with the api by the tenant that they have been authenticated under (unless they are an admin) and having improved separation of data on the data layer. The reason I chose this as my primary focus is that even with a functional system these issues pose serious security concerns of exposing sensitive personal information to non-authorized users or malicious actors.

Beyond this I also implemented a rudimentary in-memory pessimistic locking mechanism during booking creation. This was also one of the complaints we heard from the team and would cause serious data integrity complications within our system down the road that would require customer service attention. This lock will prevent the overbooking issue from happening but needs attention and improvements to be able to run in a production setting.

## Improvements Proposed
<!-- Describe 2 additional improvements you would make.
     For each: what, why, estimated effort, and trade-offs. -->

 1. I would strongly recommend revisiting the data model before further refactoring or expanding this system. While it serves the current use case of making bookings through an admin dashboard, there are denormalization issues and missing domain entities that would make it difficult to add more complex functionality (owner preferences, sitter requests, etc...) in the future. This will require significant effort in refactoring the backend up front but will make the api cleaner and more extensible going forward.
 2. My second suggested improvement would be to implement a testing framework that does not rely on manual testing going forward. This slows down development and takes some extra effort to write the tests, but the benefits of safety and stability far outweigh this.

## AI Usage
<!-- If you used AI tools, describe:
     - Which tools and how you used them
     - What you validated or changed from AI suggestions
     - What you chose NOT to use AI for and why
     If you did not use AI tools, simply state that. -->

 - I used Antigravity IDE to read the code, and interact with gemini flash models.
 - Firstly, I used AI to give me an overview of the project, the responsibilities of each of the files, and how they interact with each other. Mostly I used this to save me time and get a basic undertanding of how the project was organized.
 - As I deep dived into parts of the backend I would come accross areas where I suspected issues. I would use AI to help validate my suspicions as I looked for issues across the codebase. I did the same as I came up with solutions to these issues.
 - For sake of time saving with this excercise I used AI for code generation once I fleshed out what fixes to make and where to make them. Once AI would make these changes I would read the code generated and test with manual http requests.
 - I chose not to use AI to decide which issues to prioritize and fix with my limited amount of time. 
