# CSV Import

## Usage

- clone the repository
- run `npm install`
- open the .env file and import the necessary data.

```
    SESSION_TOKEN=xxxxxxxx
    INSTANCE_ZUID=8-xxxxxxxxx-xxxxxx

    # If the model is already exist in the instance, specify the model zuid below. if empty, it will create the model instead
    MODEL_ZUID=6-xxxxxxxxx-xxxxxx

    # to include the parent, input the 6-xxxx zuid of the model below. leave empty if none.
    PARENT_ZUID=6-xxxxxxxxx-xxxxxx

    # file location and name for the csv file.
    FILE_LOCATION=./csv/npo-list.csv
```

- copy the csv file to the `./csv` folder. rename the file as `npo-list.csv`.
- run the application. `npm run start`
