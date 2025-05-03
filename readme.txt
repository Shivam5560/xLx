Steps To do :

1. User upload one/many excel or csv data.
2. Gives the workflow or the order of preferences in which the excel operations needs to be performed or directly list all operations to be done - can be through ai or manually an input dialog box for each process - liek types,for which file,opeartions,on_column, and many more features that are required for each opeartions.
3. We need to automate those steps 


To do for You : **important
Here's a clean, step-by-step UI flow design for your Excel automation tool - if ai is required we can use that but use groq lpu inference, also data must be secured and not given to models directly,metadata can be provided:

1. File Upload Screen
    Drag & Drop Zone for Excel/CSV files
    File Preview Table (shows uploaded files with: filename, sheets, columns count, sample data)
    Next Button (enabled when ≥1 valid file uploaded)

2. Operation Selection Screen
    Operation Categories (sidebar menu):
    Column Operations (rename, delete, reorder, etc..)
    Data Operations (filter, sort, formula, etc..)
    Table Operations (merge, pivot, lookup, etc..)
    Advanced (macros, scripts, etc..)
    Search Bar to quickly find operations
    Selected Operation display area (shows chosen operation)

3. Sample Operation Configuration Flow (Example: Rename Column)

    Step 1: Select Target File

        Dropdown: "Select file to modify"
        Lists all uploaded files
        Shows preview of first 5 rows when hovered

    Step 2: Select Column(s)
        Dropdown: "Select column to rename"
        Dynamically populated based on selected file's columns
        Multi-select capability where applicable

    Step 3: New Name Input
        Input Field: "New column name"
        Validation (no special chars, unique name)
        Suggestion button ("Suggest name" using simple AI)

    Step 4: Preview & Confirm
        Side-by-side comparison:
        Before (original column header)
        After (new column header)
        Apply Button (with undo capability)

4 . Reusable Components Across Operations:
    File Selector Module
    Same dropdown UI for all operations needing file selection
    Maintains state of selected file
    Column Selector Module

Context-aware:
    Single-select for rename
    Multi-select for delete
    Type-filtered for formula operations
    Parameter Input Module

Adapts to operation:
    Text input for rename
    Formula builder for calculations
    Value picker for filters

Navigation & Flow Control:
    Back/Next buttons for multi-step operations
    Breadcrumbs showing current position in workflow
    Quick Preview pane (always visible, shows current data state)

Special Cases:

    For Lookup Operations:
        Select primary file
        Select lookup file
        Configure join keys (with type matching validation)
        Select columns to include

    For Multi-Column Operations:
        Add "Add another column" button
        Visual mapping interface for column pairs