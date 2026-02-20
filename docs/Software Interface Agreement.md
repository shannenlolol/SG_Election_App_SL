# Software Interface Agreement — data.gov.sg Dataset APIs

This document specifies the **data.gov.sg Dataset Download API (API-Open)** consumed by the **SG Election App** backend to download and refresh election datasets into MySQL.

In this implementation, **all datasets (GeoJSON boundaries and tabular datasets) are retrieved via the same pattern**:

1. Call **poll-download** to obtain a **time-limited signed download URL** (S3-like pre-signed link).
2. Download the dataset directly from the returned **signed URL**.
3. Parse the downloaded content (GeoJSON or CSV) and upsert into MySQL.

---

## 1. Base URLs

### 1.1 API-Open Dataset Download (poll-download)

```text
https://api-open.data.gov.sg/v1/public/api/datasets/{BOUNDARY_DATASET_ID}/poll-download
```

### 1.2 Signed download URL (returned by poll-download)

Example:
```text
https://s3.ap-southeast-1.amazonaws.com/blobs.data.gov.sg/d_7fb48bf0b7b7c8deeccfb2b40d120e08.geojson?AWSAccessKeyId=ASIAU7LWPY2WLV7EG6AX&Expires=1770632671&Signature=6zpHY4PTh0pPWP96yYzZVziBh2w%3D&X-Amzn-Trace-Id=Root%3D1-6989a7cf-788ecae605db6cf4328e4da3%3BParent%3D26bb3e00e5d23331%3BSampled%3D0%3BLineage%3D1%3Affb76583%3A0&response-content-disposition=attachment%3B%20filename%3D%22ElectoralBoundary2006GEOJSON.geojson%22&x-amz-security-token=IQoJb3JpZ2luX2VjEMH%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaDmFwLXNvdXRoZWFzdC0xIkcwRQIhAP4bpxTipyFDNOlQmW3a5GswffiMM%2B9dB4Y1YPrpJJczAiBUG74QJ%2BBXyK%2Bdfj8hJi6CpqaiVpG8L2ZN5sv2reD%2F8SqzAwiK%2F%2F%2F%2F%2F%2F%2F%2F%2F%2F8BEAQaDDM0MjIzNTI2ODc4MCIMa8oVApx1Qq8wc4MAKocDkoF%2FLZ9Bjgkk4wkFH0hRq4scEKxsiYKx%2BMa7PvBTWKYOUbVcNHdM3o8XPHvMDxHlXxcDloygyy3hI1VzowLWXj5G0AdF22EiWKW96kAZBTnjHScMph6enLDvlyArzCy93nq8jyOlG3KXminyEbgAiNW5Ny5fg7gQYTckH59OEcgtMsk6Riw4lGQ9Pmjg0%2FX1Ib5b4Osk7R861rwpv1HMSgwzYI2%2BQiCsteqMsD7CVmNf7J9v4k5OSDs1Vus%2FaLbx1Q6eh7c8nvasgq6mLLh2oeheqDXcB0gsoxT8QFZZfcmEZNpVwVevR3f5rXhdx4R0XBJfG4j8MuKS0OEJqoGW1dlyIM3UAn0Ww7x%2Ba3Nwq%2BZnUqFLpgwoXCjcCP6ArWZY2IoymqOW2eTh4sZgHPKZzvlAoMdAh0QneMfy%2B0uqKpKIZH%2Bg%2FJ9aYGGGe2%2BCXGCUPOnz6IIe048kYVs3W72nS7kUXfEt2pVZLHeJLmZ4%2B5kPS%2FV9LHcDnor2SYUB19jqZbjkxJuhvzD5vabMBjqdAcVF6KvyJKitVuGs7HvmTDtbmm%2B40Qq%2Buf0h%2FnuMDQL%2FrU6rnnasvIdHnNLx8v%2B%2FAe5o%2FL7FcoMnOEPzmL1ru2dIh28QemUVWBLGMHyaVEaVsKTlDRbffVxAYsMhnHRyUavCdxcolPgMMQBPRUkGcysUFuUF%2BJ9Y%2Fk7FjwhrMBVs6MdCiaH2hTdeQgHvnBhN5g4CkAmZXts4yqUwBdE%3D
```

The signed URL is time-limited and behaves like an object-storage pre-signed URL (S3-like behaviour): it grants temporary permission to download the dataset file without exposing storage credentials.

---

## 2. Authentication

Using the data.gov.sg API key will give a higher quota (or less aggressive throttling) compared with anonymous requests, so hits with HTTP 429 occur less often.

```text
x-api-key: <API_KEY>
Accept: application/json
```

---

## 3. Why signed URL approach was used (poll-download)

* Bulk file download reduces the number of API calls compared with row-by-row retrieval, which helps lower the chance of repeated throttling.
* The signed URL approach is well-suited for ETL (Extract, Transform, Load): download once, parse locally, then upsert into MySQL.
* The backend serves the app from MySQL, so the sync job can be decoupled from data.gov.sg availability and rate limits during normal app usage.

---

## 4. Datasets Used by SG Election App

### 4.1 Boundary GeoJSON datasets

| Year | Boundary Dataset ID                  | Poll-download URL (full)                                                                               |
| ---- | ------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| 2006 | `d_7fb48bf0b7b7c8deeccfb2b40d120e08` | `https://api-open.data.gov.sg/v1/public/api/datasets/d_7fb48bf0b7b7c8deeccfb2b40d120e08/poll-download` |
| 2011 | `d_305b03ed3c477aba648eeddaea2d4279` | `https://api-open.data.gov.sg/v1/public/api/datasets/d_305b03ed3c477aba648eeddaea2d4279/poll-download` |
| 2015 | `d_1dea85025d48bc75ed566eb2696b7e0f` | `https://api-open.data.gov.sg/v1/public/api/datasets/d_1dea85025d48bc75ed566eb2696b7e0f/poll-download` |
| 2020 | `d_6077aa5ab73d447b32f451ea224221b6` | `https://api-open.data.gov.sg/v1/public/api/datasets/d_6077aa5ab73d447b32f451ea224221b6/poll-download` |
| 2025 | `d_7ddf956dfc1c59080bf95bba1c58a5d2` | `https://api-open.data.gov.sg/v1/public/api/datasets/d_7ddf956dfc1c59080bf95bba1c58a5d2/poll-download` |

---

### 4.2 Tabular datasets

These datasets are downloaded as CSV files. After download, the sync job parses the file and upserts into MySQL tables.

| Data Area                      | Dataset ID                           | Poll-download URL (full)                                                                               | Expected download format |
| ------------------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------ | ------------------------ |
| Political parties list         | `d_ef163fd9ebc3c2f21032c29da3bd3f77` | `https://api-open.data.gov.sg/v1/public/api/datasets/d_ef163fd9ebc3c2f21032c29da3bd3f77/poll-download` | CSV (tabular)            |
| Registered / rejected / spoilt | `d_fdfb854fcb7428b29734d2e0c0674220` | `https://api-open.data.gov.sg/v1/public/api/datasets/d_fdfb854fcb7428b29734d2e0c0674220/poll-download` | CSV (tabular)            |
| Election dates                 | `d_00d89e5d100a612e36432d91493785bd` | `https://api-open.data.gov.sg/v1/public/api/datasets/d_00d89e5d100a612e36432d91493785bd/poll-download` | CSV (tabular)            |
| Results by candidate           | `d_581a30bee57fa7d8383d6bc94739ad00` | `https://api-open.data.gov.sg/v1/public/api/datasets/d_581a30bee57fa7d8383d6bc94739ad00/poll-download` | CSV (tabular)            |

---

## 5. Detailed API Specifications

## 5.1 Poll-download (Step 1: obtain signed URL)

**Endpoint (full)**

```text
GET https://api-open.data.gov.sg/v1/public/api/datasets/{datasetId}/poll-download
```

**Path parameters**

| Parameter   | Type   | Required | Description                                                |
| ----------- | ------ | -------- | ---------------------------------------------------------- |
| `datasetId` | string | Yes      | Dataset ID to download (GeoJSON boundary or table dataset) |

**Headers**

```text
Accept: application/json
x-api-key: <API_KEY>
```

**Example request (Results by candidate dataset)**

```http
GET https://api-open.data.gov.sg/v1/public/api/datasets/d_581a30bee57fa7d8383d6bc94739ad00/poll-download
Accept: application/json
x-api-key: <API_KEY>
```

**200 response body**

```json
{
    "code": 0,
    "data": {
        "url": "https://s3.ap-southeast-1.amazonaws.com/blobs.data.gov.sg/d_1dea85025d48bc75ed566eb2696b7e0f.geojson?AWSAccessKeyId=ASIAU7LWPY2WAMAU4IIM&Expires=1770701665&Signature=vj%2FZ8RgUapQklwAZTn5hvsGBfjA%3D&X-Amzn-Trace-Id=Root%3D1-698ab551-04973fbb0774be4a19649e53%3BParent%3D588c80922b1cacf8%3BSampled%3D1%3BLineage%3D1%3Affb76583%3A0&response-content-disposition=attachment%3B%20filename%3D%22ElectoralBoundary2015GEOJSON.geojson%22&x-amz-security-token=IQoJb3JpZ2luX2VjENT%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaDmFwLXNvdXRoZWFzdC0xIkcwRQIgNtvNSqkZJG3HiHoQP%2B4lQo2DG%2FQj0g67BdnlKTaGhYoCIQChUYlpyzOdDBVTHu0Xu2DeoNoc%2FjoOosR7UIv4e%2FgMEiqzAwid%2F%2F%2F%2F%2F%2F%2F%2F%2F%2F8BEAQaDDM0MjIzNTI2ODc4MCIMA9I%2FfbzDu5k%2FV6kMKocDxjgbpnIsQ0%2FcyU7AtNiXjQXcSF2O6T09WzShmzWDaMr0E02ub1L6eD0x41tMTBZootFal8Tykvy%2FbSaMKqCuFXsceu52YYYMK8apWyTT9363kKofCs6Wydb7PXg2ub3QRuQx%2Fo5%2Bk7gYFcBTiXJmWMpKQOt8fghaVfHz2LWtmhMxtj1F7I6VX3u1Sm6qFrBCD5nbpGoquxTGjozrcvt2PHEtjf0h1agF92zvK3OrU9CW5nXz85ubrFA%2BI5y2Xli3FRcqoSOOQS28iILYP1HkDYfoC4Sb26ZCbHgj01Z2VI1XdaQEkqdVVT4OmFY6o39gZCgmMW5OYcTCEFsa%2BTcC%2BHwu7xNZt0MBXsEUrW0WSmc57nqkLa%2BFmn7LVcKKGzTMohaByrFpXLY94iQSG8%2FVw48pfBC1PCjySmKvn3uVey76UB7X2V37VrF15jX0cYiQEyiUn0iUopp%2FgFeZw0a%2FXAlHRt9QtWnYxxa8maEOReJYh7iq11EhFKqajwqouUKyM67mxDMUqjCFyqrMBjqdAYuGiP746Pci0KBr6%2FdkHHIAY2olnH8WIOlqQqB86M5xmPCuGLVrkocPcEvgYlFb2d9XZKG%2BVWTn3SLA3lda72pOhoailtcKgIsQ9XY7BvGjCRmtgvRPbIGn%2FqUqSnQCoqndE%2FWqZ1m8tw%2Far5FQB%2FW%2BHqYReM5tRGD9aimjp7t4MVdTbti1yo%2BUnf3RKjbDAhxSw7lVmvhZ3lQo3O4%3D"
    },
    "errorMsg": ""
}
```
---

## 5.2 Signed URL download (Step 2: download the dataset file)

**Endpoint**

```text
GET <signedUrl>
```

**Description**
Downloads the dataset content directly from the time-limited signed URL returned in `data.url`. If the link expires before download completes, a new signed URL must be obtained by calling **poll-download** again.

---

### 5.2.1 Boundary GeoJSON download (eg. 2025: `d_7ddf956dfc1c59080bf95bba1c58a5d2`)

**Poll-download URL (Step 1)**

```text
GET https://api-open.data.gov.sg/v1/public/api/datasets/d_7ddf956dfc1c59080bf95bba1c58a5d2/poll-download
```

**Signed URL download (Step 2)**

```text
GET https://s3.ap-southeast-1.amazonaws.com/blobs.data.gov.sg/d_1dea85025d48bc75ed566eb2696b7e0f.geojson?AWSAccessKeyId=ASIAU7LWPY2WAMAU4IIM&Expires=1770701665&Signature=vj%2FZ8RgUapQklwAZTn5hvsGBfjA%3D&X-Amzn-Trace-Id=Root%3D1-698ab551-04973fbb0774be4a19649e53%3BParent%3D588c80922b1cacf8%3BSampled%3D1%3BLineage%3D1%3Affb76583%3A0&response-content-disposition=attachment%3B%20filename%3D%22ElectoralBoundary2015GEOJSON.geojson%22&x-amz-security-token=IQoJb3JpZ2luX2VjENT%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaDmFwLXNvdXRoZWFzdC0xIkcwRQIgNtvNSqkZJG3HiHoQP%2B4lQo2DG%2FQj0g67BdnlKTaGhYoCIQChUYlpyzOdDBVTHu0Xu2DeoNoc%2FjoOosR7UIv4e%2FgMEiqzAwid%2F%2F%2F%2F%2F%2F%2F%2F%2F%2F8BEAQaDDM0MjIzNTI2ODc4MCIMA9I%2FfbzDu5k%2FV6kMKocDxjgbpnIsQ0%2FcyU7AtNiXjQXcSF2O6T09WzShmzWDaMr0E02ub1L6eD0x41tMTBZootFal8Tykvy%2FbSaMKqCuFXsceu52YYYMK8apWyTT9363kKofCs6Wydb7PXg2ub3QRuQx%2Fo5%2Bk7gYFcBTiXJmWMpKQOt8fghaVfHz2LWtmhMxtj1F7I6VX3u1Sm6qFrBCD5nbpGoquxTGjozrcvt2PHEtjf0h1agF92zvK3OrU9CW5nXz85ubrFA%2BI5y2Xli3FRcqoSOOQS28iILYP1HkDYfoC4Sb26ZCbHgj01Z2VI1XdaQEkqdVVT4OmFY6o39gZCgmMW5OYcTCEFsa%2BTcC%2BHwu7xNZt0MBXsEUrW0WSmc57nqkLa%2BFmn7LVcKKGzTMohaByrFpXLY94iQSG8%2FVw48pfBC1PCjySmKvn3uVey76UB7X2V37VrF15jX0cYiQEyiUn0iUopp%2FgFeZw0a%2FXAlHRt9QtWnYxxa8maEOReJYh7iq11EhFKqajwqouUKyM67mxDMUqjCFyqrMBjqdAYuGiP746Pci0KBr6%2FdkHHIAY2olnH8WIOlqQqB86M5xmPCuGLVrkocPcEvgYlFb2d9XZKG%2BVWTn3SLA3lda72pOhoailtcKgIsQ9XY7BvGjCRmtgvRPbIGn%2FqUqSnQCoqndE%2FWqZ1m8tw%2Far5FQB%2FW%2BHqYReM5tRGD9aimjp7t4MVdTbti1yo%2BUnf3RKjbDAhxSw7lVmvhZ3lQo3O4%3D
```

**200 response body (GeoJSON, truncated example)**

```json
{
    "type": "FeatureCollection",
    "name": "dgs_ge2025",
    "crs": {
        "type": "name",
        "properties": {
            "name": "urn:ogc:def:crs:OGC:1.3:CRS84"
        }
    },
    "features": [
        {
            "type": "Feature",
            "properties": {
                "FID": 0,
                "ED_DESC": "JURONG EAST-BUKIT BATOK",
                "ED_DESC_FU": "JURONG EAST-BUKIT BATOK GRC",
                "Name": "JURONG EAST-BUKIT BATOK",
                "NEW_ED": "JE"
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [
                    [
                        [
                            103.752759871196986,
                            1.349528977195389
                        ],
                        [
                            103.752568496519984,
                            1.349633365108964
                        ],
                        ...
                        ...
                    ]
                  ]   
              }
    }
  ]
}
```
---

### 5.2.2 Results by candidate (CSV download) — `d_581a30bee57fa7d8383d6bc94739ad00`

**Poll-download URL (Step 1)**

```text
GET https://api-open.data.gov.sg/v1/public/api/datasets/d_581a30bee57fa7d8383d6bc94739ad00/poll-download
```

**Signed URL download (Step 2)**

```text
GET https://s3.ap-southeast-1.amazonaws.com/table-downloads-ingest.data.gov.sg/d_581a30bee57fa7d8383d6bc94739ad00/2003c2d392ff68072914bf0e172ad56641967701a3b76503d2e8e0011d6ae8a7.csv?AWSAccessKeyId=ASIAU7LWPY2WPRO4FSFX&Expires=1770695064&Signature=oprl%2BTDYxVrz2FiBOMzBgEWpUT0%3D&X-Amzn-Trace-Id=Root%3D1-698a9b88-12f4bafe31f696916103c399%3BParent%3D5c648e8c835188f5%3BSampled%3D0%3BLineage%3D1%3Affb76583%3A0&response-content-disposition=attachment%3B%20filename%3D%22ParliamentaryGeneralElectionResultsbyCandidate.csv%22&x-amz-security-token=IQoJb3JpZ2luX2VjENP%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaDmFwLXNvdXRoZWFzdC0xIkcwRQIhALFFF%2FS3JrfkJKIu7lx5BL5fNThFuGn346TAYw3GwT6nAiAsgyDhDr6VTyZLY%2FHJqVgBCYXEXMlU4Vtsupu5PSjw8iqzAwic%2F%2F%2F%2F%2F%2F%2F%2F%2F%2F8BEAQaDDM0MjIzNTI2ODc4MCIMk4BsUad8ZTX1hCBjKocD5YJCX3VF0Siu1b2X2yLYG0AdFLO7It02Hhy6lDyqWw%2BQ%2B1Svx4MBNIOZORmHp2GXDiSV5%2F36cxgwrnrpbOzCzJ7vi4zKsrvBAKPBpKhiTGbBIiY%2FaupPUtZcH40qDQex%2BksLC%2BDHR2GDp54NRYh3IMaS3RpPVZyZayB9iHgbPpo2vjbDaAXVh8vFkmxzTmycgdpMr4nQwv5boawoUQkEk6wCVa4jgON82BSsoaYUgdwG209sVSadOg7nGiMpOOIKOEO4SBic2xMWmNOift%2BBsORPqiVInizT4Pyk4loiMSIM76rykUTlrkWe7NUQng8NARfPVO21c0JJ0tUsIudRNVUynqmJCM7TCeQcrs1CCw8gIT1awXa93%2BeAGqDaGxMWPJ%2BQW%2FeW509PWGNvdyATIhWWCyzTF7C6521tlQlOQsvEEEZOGBl4Ld8%2FYnysduhS2xuEk%2FgM9q8pB9LIFcIhRzbKR2snEr7Q38e9UXd7EEFN7r8I7rDL32QFs0PTENp3I3ArHw0NETCKsKrMBjqdAbW7e3KA0GZ%2FGCN0WggDHi6wV9%2F5jks2ap75DLw8SQjJj5Dmjp3Y4iYvjRHHCS4H2RAij0IEq9r2rL4W3u%2Bu57HH9LvtW1%2ButnP4HAXBpVMICVLDVsDnZpYS%2F5SzoSP4%2FTx2Zb81JvX%2BLLNa98ROPND5tDh%2BmiOKdzruujMMWLxTIrJZ0Bh34SgXd2N2QsNjHoFtefRPMCUuCT4a4A8%3D
```

**200 response body (CSV, truncated example)**

```text
year,constituency,constituency_type,candidates,party,vote_count,vote_percentage
1955,Bukit Panjang,na,Goh Tong Liang,PP,3097,0.7221
1955,Bukit Panjang,na,Lim Wee Toh,SLF,1192,0.2779
1955,Bukit Timah,na,S. F. Ho,PP,722,0.1162
1955,Bukit Timah,na,Lim Ching Siong,PAP,3259,0.5245
...
```

---

### 5.2.3 Registered, Rejected and Spoilt Ballots (CSV download) — `d_fdfb854fcb7428b29734d2e0c0674220`

**Poll-download URL (Step 1)**

```text
GET https://api-open.data.gov.sg/v1/public/api/datasets/d_fdfb854fcb7428b29734d2e0c0674220/poll-download
```

**Signed URL download (Step 2)**

```text
GET https://s3.ap-southeast-1.amazonaws.com/table-downloads-ingest.data.gov.sg/d_fdfb854fcb7428b29734d2e0c0674220/dc977c13eaf9c6c1be675f50ea77d479dde60fb97de1aab72e84edfbb2972173.csv?AWSAccessKeyId=ASIAU7LWPY2WPRO4FSFX&Expires=1770694990&Signature=nnmcbFvNeMsYIseJq4yQs5oP43I%3D&X-Amzn-Trace-Id=Root%3D1-698a9b3e-52680ff205ebb78c0aba8c3c%3BParent%3Dbd9b00e6557e759a%3BSampled%3D0%3BLineage%3D1%3Affb76583%3A0&response-content-disposition=attachment%3B%20filename%3D%22ParliamentaryGeneralElectionRegisteredElectorsRejectedVotesandSpoiltBallots.csv%22&x-amz-security-token=IQoJb3JpZ2luX2VjENP%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaDmFwLXNvdXRoZWFzdC0xIkcwRQIhALFFF%2FS3JrfkJKIu7lx5BL5fNThFuGn346TAYw3GwT6nAiAsgyDhDr6VTyZLY%2FHJqVgBCYXEXMlU4Vtsupu5PSjw8iqzAwic%2F%2F%2F%2F%2F%2F%2F%2F%2F%2F8BEAQaDDM0MjIzNTI2ODc4MCIMk4BsUad8ZTX1hCBjKocD5YJCX3VF0Siu1b2X2yLYG0AdFLO7It02Hhy6lDyqWw%2BQ%2B1Svx4MBNIOZORmHp2GXDiSV5%2F36cxgwrnrpbOzCzJ7vi4zKsrvBAKPBpKhiTGbBIiY%2FaupPUtZcH40qDQex%2BksLC%2BDHR2GDp54NRYh3IMaS3RpPVZyZayB9iHgbPpo2vjbDaAXVh8vFkmxzTmycgdpMr4nQwv5boawoUQkEk6wCVa4jgON82BSsoaYUgdwG209sVSadOg7nGiMpOOIKOEO4SBic2xMWmNOift%2BBsORPqiVInizT4Pyk4loiMSIM76rykUTlrkWe7NUQng8NARfPVO21c0JJ0tUsIudRNVUynqmJCM7TCeQcrs1CCw8gIT1awXa93%2BeAGqDaGxMWPJ%2BQW%2FeW509PWGNvdyATIhWWCyzTF7C6521tlQlOQsvEEEZOGBl4Ld8%2FYnysduhS2xuEk%2FgM9q8pB9LIFcIhRzbKR2snEr7Q38e9UXd7EEFN7r8I7rDL32QFs0PTENp3I3ArHw0NETCKsKrMBjqdAbW7e3KA0GZ%2FGCN0WggDHi6wV9%2F5jks2ap75DLw8SQjJj5Dmjp3Y4iYvjRHHCS4H2RAij0IEq9r2rL4W3u%2Bu57HH9LvtW1%2ButnP4HAXBpVMICVLDVsDnZpYS%2F5SzoSP4%2FTx2Zb81JvX%2BLLNa98ROPND5tDh%2BmiOKdzruujMMWLxTIrJZ0Bh34SgXd2N2QsNjHoFtefRPMCUuCT4a4A8%3D
```

**200 response body (CSV, truncated example)**

```text
year,constituency,no_of_registered_electors,no_of_rejected_votes,no_of_spoilt_ballot_papers
1955,Bukit Panjang,8012,66,7
1955,Bukit Timah,9173,59,8
1955,Cairnhill,13528,65,12
...
```
---

### 5.2.4 Election dates (CSV download) — `d_00d89e5d100a612e36432d91493785bd`

**Poll-download URL (Step 1)**

```text
GET https://api-open.data.gov.sg/v1/public/api/datasets/d_00d89e5d100a612e36432d91493785bd/poll-download
```

**Signed URL download (Step 2)**

```text
GET https://s3.ap-southeast-1.amazonaws.com/table-downloads-ingest.data.gov.sg/d_00d89e5d100a612e36432d91493785bd/edbc337314bc0efbe858a15728cbd22f6b237123d9ab1dffec88f4c7512b6c0d.csv?AWSAccessKeyId=ASIAU7LWPY2WAMAU4IIM&Expires=1770701940&Signature=2w2EOpOyD0hWw%2BixAZubWUqS1Xs%3D&X-Amzn-Trace-Id=Root%3D1-698ab664-03d17706521e6d0869a51cd2%3BParent%3Db9480065c261aee5%3BSampled%3D0%3BLineage%3D1%3Affb76583%3A0&response-content-disposition=attachment%3B%20filename%3D%22ParliamentaryGeneralElectionDates.csv%22&x-amz-security-token=IQoJb3JpZ2luX2VjENT%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaDmFwLXNvdXRoZWFzdC0xIkcwRQIgNtvNSqkZJG3HiHoQP%2B4lQo2DG%2FQj0g67BdnlKTaGhYoCIQChUYlpyzOdDBVTHu0Xu2DeoNoc%2FjoOosR7UIv4e%2FgMEiqzAwid%2F%2F%2F%2F%2F%2F%2F%2F%2F%2F8BEAQaDDM0MjIzNTI2ODc4MCIMA9I%2FfbzDu5k%2FV6kMKocDxjgbpnIsQ0%2FcyU7AtNiXjQXcSF2O6T09WzShmzWDaMr0E02ub1L6eD0x41tMTBZootFal8Tykvy%2FbSaMKqCuFXsceu52YYYMK8apWyTT9363kKofCs6Wydb7PXg2ub3QRuQx%2Fo5%2Bk7gYFcBTiXJmWMpKQOt8fghaVfHz2LWtmhMxtj1F7I6VX3u1Sm6qFrBCD5nbpGoquxTGjozrcvt2PHEtjf0h1agF92zvK3OrU9CW5nXz85ubrFA%2BI5y2Xli3FRcqoSOOQS28iILYP1HkDYfoC4Sb26ZCbHgj01Z2VI1XdaQEkqdVVT4OmFY6o39gZCgmMW5OYcTCEFsa%2BTcC%2BHwu7xNZt0MBXsEUrW0WSmc57nqkLa%2BFmn7LVcKKGzTMohaByrFpXLY94iQSG8%2FVw48pfBC1PCjySmKvn3uVey76UB7X2V37VrF15jX0cYiQEyiUn0iUopp%2FgFeZw0a%2FXAlHRt9QtWnYxxa8maEOReJYh7iq11EhFKqajwqouUKyM67mxDMUqjCFyqrMBjqdAYuGiP746Pci0KBr6%2FdkHHIAY2olnH8WIOlqQqB86M5xmPCuGLVrkocPcEvgYlFb2d9XZKG%2BVWTn3SLA3lda72pOhoailtcKgIsQ9XY7BvGjCRmtgvRPbIGn%2FqUqSnQCoqndE%2FWqZ1m8tw%2Far5FQB%2FW%2BHqYReM5tRGD9aimjp7t4MVdTbti1yo%2BUnf3RKjbDAhxSw7lVmvhZ3lQo3O4%3D
```

**200 response body (CSV, truncated example)**

```text
year,nomination_day,polling_day
1955,1955-02-28,1955-04-02
1959,1959-04-25,1959-05-30
1963,1963-09-12,1963-09-21
1968,1968-02-17,1968-04-13
1972,1972-08-23,1972-09-02
...
```

---

### 5.2.5 List of Political Parties (CSV download) — dataset `d_ef163fd9ebc3c2f21032c29da3bd3f77`

**Poll-download URL (Step 1)**

```text
GET https://api-open.data.gov.sg/v1/public/api/datasets/d_ef163fd9ebc3c2f21032c29da3bd3f77/poll-download
```

**Signed URL download (Step 2)**

```text
GET https://s3.ap-southeast-1.amazonaws.com/table-downloads-ingest.data.gov.sg/d_ef163fd9ebc3c2f21032c29da3bd3f77/b667a32420f54b67ced418fd133184f5542928b4ae406a3839ed67e083245018.csv?AWSAccessKeyId=ASIAU7LWPY2WPRO4FSFX&Expires=1770695018&Signature=KdupOd3PZIct9J6yWHmuO2j0f3o%3D&X-Amzn-Trace-Id=Root%3D1-698a9b5a-57f8f6c167832b6b17f04614%3BParent%3Dfaeb9ac5aaf4f275%3BSampled%3D0%3BLineage%3D1%3Affb76583%3A0&response-content-disposition=attachment%3B%20filename%3D%22ListofPoliticalParties.csv%22&x-amz-security-token=IQoJb3JpZ2luX2VjENP%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaDmFwLXNvdXRoZWFzdC0xIkcwRQIhALFFF%2FS3JrfkJKIu7lx5BL5fNThFuGn346TAYw3GwT6nAiAsgyDhDr6VTyZLY%2FHJqVgBCYXEXMlU4Vtsupu5PSjw8iqzAwic%2F%2F%2F%2F%2F%2F%2F%2F%2F%2F8BEAQaDDM0MjIzNTI2ODc4MCIMk4BsUad8ZTX1hCBjKocD5YJCX3VF0Siu1b2X2yLYG0AdFLO7It02Hhy6lDyqWw%2BQ%2B1Svx4MBNIOZORmHp2GXDiSV5%2F36cxgwrnrpbOzCzJ7vi4zKsrvBAKPBpKhiTGbBIiY%2FaupPUtZcH40qDQex%2BksLC%2BDHR2GDp54NRYh3IMaS3RpPVZyZayB9iHgbPpo2vjbDaAXVh8vFkmxzTmycgdpMr4nQwv5boawoUQkEk6wCVa4jgON82BSsoaYUgdwG209sVSadOg7nGiMpOOIKOEO4SBic2xMWmNOift%2BBsORPqiVInizT4Pyk4loiMSIM76rykUTlrkWe7NUQng8NARfPVO21c0JJ0tUsIudRNVUynqmJCM7TCeQcrs1CCw8gIT1awXa93%2BeAGqDaGxMWPJ%2BQW%2FeW509PWGNvdyATIhWWCyzTF7C6521tlQlOQsvEEEZOGBl4Ld8%2FYnysduhS2xuEk%2FgM9q8pB9LIFcIhRzbKR2snEr7Q38e9UXd7EEFN7r8I7rDL32QFs0PTENp3I3ArHw0NETCKsKrMBjqdAbW7e3KA0GZ%2FGCN0WggDHi6wV9%2F5jks2ap75DLw8SQjJj5Dmjp3Y4iYvjRHHCS4H2RAij0IEq9r2rL4W3u%2Bu57HH9LvtW1%2ButnP4HAXBpVMICVLDVsDnZpYS%2F5SzoSP4%2FTx2Zb81JvX%2BLLNa98ROPND5tDh%2BmiOKdzruujMMWLxTIrJZ0Bh34SgXd2N2QsNjHoFtefRPMCUuCT4a4A8%3D
```

**200 response body (CSV, truncated example)**

```text
abbreviation,political_party
AI,Angkatan Islam Singapura (Angkasa)
BS,Barisan Sosialis
CP,Citizens' Party
DP,Democratic Party
DPP,Democratic Progressive Party
...
```


## 6. SG Election App Backend APIs (Express + MySQL)

This section specifies the **backend HTTP APIs** exposed by the SG Election App server. These APIs are consumed by:

* The **React frontend** (for login, dashboard, boundaries, etc.).
* The **embedded Dash app** (served through a reverse proxy under `/dash/`).

Unless stated otherwise, endpoints are **protected** by `requireAuth` and require a valid **JWT cookie** (`token`) set by the login endpoint.

---

### 6.1 Base URL

In local development, the backend  runs on:

```text
http://localhost:4000
```

All API routes below are relative to the backend base URL.

---

### 6.2 Endpoint Summary

### 6.2.1 Auth endpoints

| Method | Path               |  Description                        |
| ------ | ------------------ | ---------------------------------- |
| POST   | `/api/auth/login`  |Login; sets `token` cookie         |
| POST   | `/api/auth/logout` | Logout; clears `token` cookie      |
endpoint: auth + cookie keys |

---

### 6.2.2 Dashboard endpoints

Dashboard routes are mounted under:

```text
/api/dashboard
```

| Method | Path                            | Description                                                    |
| ------ | ------------------------------- | -------------------------------------------------------------- |
| GET    | `/api/dashboard/options`        | Loads dashboard filter options and summary tab            |
| GET    | `/api/dashboard/search`         | Searches dashboard rows                   |
| GET    | `/api/dashboard/details`        | Loads details for a selected row          |
---

### 6.2.3 Boundaries endpoints

Boundaries routes are mounted under:

```text
/api/boundaries
```

| Method | Path                                |  Description                                          |
| ------ | ----------------------------------- |---------------------------------------------------- |
| GET    | `/api/boundaries?year=YYYY`         | Returns boundary GeoJSON for the year                  |
| GET    | `/api/boundaries/summary?year=YYYY` | Returns summary statistics for boundaries for the year |

---

## 6.3 Detailed API Specifications

## 6.3.1 POST `/api/auth/login`

**Description**

Authenticates a user and sets the `token` cookie.

**Request body (JSON)**

| Field      | Type   | Required | Description |
| ---------- | ------ | -------- | ----------- |
| `username` | string | Yes      | Username    |
| `password` | string | Yes      | Password    |

**Responses**

* `200 OK`: sets cookie `token`, returns user profile fields
* `400 Bad Request`: missing username/password
* `401 Unauthorized`: invalid credentials
* `500 Internal Server Error`: unexpected server error

**200 response body**

```json
{
  "username": "diana",
  "role_name": "civilian",
  "area": "PIONEER"
}
```

---

## 6.3.2 POST `/api/auth/logout`

**Description**

Logs the user out and clears the `token` cookie.

**Request body**
None.

**Example request**

```http
POST /api/auth/logout
Accept: application/json
Cookie: token=<jwt>
```

**200 response body**

```json
{
  "message": "Logged out."
}
```
---

## 6.3.3 GET `/api/dashboard/options`

**Description**

Populates dropdown options as well as summary tab figures and tables.

**Query parameters**

None.

**200 response body**

```json
{
  "years": [1955, 1959, 1963, 1968, 1972, 2020, 2025],
  "parties": [
    { "abbreviation": "PAP", "full_name": "People's Action Party" },
    { "abbreviation": "WP", "full_name": "Workers' Party" }
    ...
  ],
  "constituencies": [
    { "constituency": "MARINE PARADE-BRADDELL HEIGHTS" },
    { "constituency": "TANJONG PAGAR" }
    ...
  ],
  "election_dates": [
    { "year": 1955, "nomination_day": "1955-02-28", "polling_day": "1955-04-02" },
    { "year": 2025, "nomination_day": "2025-04-28", "polling_day": "2025-05-04" }
    ...
  ]
}
```
---

## 6.3.4 GET `/api/dashboard/search`

**Description**

Returns **dashboard rows** from the backend based on optional filters. This endpoint is called whenever filters change, and the returned rows are displayed in the DataTable.

**Query parameters**

All are optional. When omitted/empty, the backend returns unfiltered results.

| Parameter        | Type   | Required | Description                                                                                                |
| ---------------- | ------ | -------- | ---------------------------------------------------------------------------------------------------------- |
| `years`          | string | No       | CSV list of years (e.g., `2020,2025`)                                                                      |
| `winners`        | string | No       | CSV list of winner party abbreviations                                                                     |
| `types`          | string | No       | CSV list of constituency types (`GRC,SMC`)                                                                 |
| `constituencies` | string | No       | CSV list of constituency names                                                                             |
| `contesting`     | string | No       | CSV list of contesting parties |

**Example request**

```http
GET /api/dashboard/search?years=2020,2025&winners=PAP,WP&types=GRC&constituencies=MARINE%20PARADE-BRADDELL%20HEIGHTS
Accept: application/json
Cookie: token=<jwt>
```

**200 response body**

```json
{
  "rows": [
    {
      "year": 2025,
      "constituency": "MARINE PARADE-BRADDELL HEIGHTS",
      "constituency_type": "GRC",
      "winner_party": "PAP",
      "margin_pct": 1.0,
      "turnout_pct": 0.945,

      "contesting_parties_csv": "PAP,WP,PSP"
    }
  ]
}
```
---

## 6.3.5 GET `/api/dashboard/details`

**Description**

Returns **details** for a selected `(year, constituency)` row which populates the right-side details panel:

* votes-by-party bar chart
* elector pie chart (registered/rejected/spoilt)
* candidates table

**Query parameters**

| Parameter      | Type   | Required | Description       |
| -------------- | ------ | -------- | ----------------- |
| `year`         | number | Yes      | Election year     |
| `constituency` | string | Yes      | Constituency name |

**Example request**

```http
GET /api/dashboard/details?year=2025&constituency=MARINE%20PARADE-BRADDELL%20HEIGHTS
Accept: application/json
Cookie: token=<jwt>
```

**200 response body**

```json
{
  "parties": [
    {
      "party": "PAP",
      "party_full_name": "People's Action Party",
      "vote_count": 12345,
      "vote_share": 0.6123,
      "candidates": "A;B;C;D"
    },
    {
      "party": "WP",
      "party_full_name": "Workers' Party",
      "vote_count": 7821,
      "vote_share": 0.3877,
      "candidates": "E;F;G;H"
    }
  ],
  "elector": {
    "no_of_registered_electors": 50000,
    "no_of_rejected_votes": 120,
    "no_of_spoilt_ballot_papers": 80
  }
}
```
---

## 6.3.6 GET `/api/boundaries?year=YYYY`

**Description**

Returns boundary GeoJSON for the year.

**Query parameters**

| Parameter | Type   | Required | Description                                        |
| --------- | ------ | -------- | -------------------------------------------------- |
| `year`    | number | Yes      | Boundary year (e.g., 2006, 2011, 2015, 2020, 2025) |

---

**Example request**

```http
GET /api/boundaries?year=2025
Accept: application/json
Cookie: token=<jwt>
```

---

**200 response body (GeoJSON, truncated example)**

```json
{
  "type": "FeatureCollection",
  "name": "dgs_ge2025",
  "crs": {
    "type": "name",
    "properties": {
      "name": "urn:ogc:def:crs:OGC:1.3:CRS84"
    }
  },
  "features": [
    {
      "type": "Feature",
      "properties": {
        "FID": 0,
        "ED_DESC": "JURONG EAST-BUKIT BATOK",
        "ED_DESC_FU": "JURONG EAST-BUKIT BATOK GRC",
        "Name": "JURONG EAST-BUKIT BATOK",
        "NEW_ED": "JE"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [103.75275987119699, 1.349528977195389],
            [103.75256849651998, 1.349633365108964],
            [103.7523219230196, 1.349598112092441]
            ...
          ]
        ]
      }
      ...
    }
  ]
}
```

---

## 6.3.7 GET `/api/boundaries/summary?year=YYYY`

**Description**
Returns a **per-constituency election summary** for a given year, keyed by **boundary-style constituency key**, including:

* `winnerParty`
* `constituencyType`
* `parties`

This is used for the tooltip details when hovering a boundary.

**Query parameters**

| Parameter | Type   | Required | Description                                                     |
| --------- | ------ | -------- | --------------------------------------------------------------- |
| `year`    | number | Yes      | Election year to summarise (e.g., 2006, 2011, 2015, 2020, 2025) |

**Example request**

```http
GET /api/boundaries/summary?year=2025
Accept: application/json
Cookie: token=<jwt>
```

**200 response body (example)**

```json
{
  "year": 2025,
  "parties": ["PAP", "PSP", "WP"],
  "summary": {
    "JURONG EAST-BUKIT BATOK GRC": {
      "winnerParty": "PAP",
      "constituencyType": "GRC",
      "parties": {
        "PAP": { "votePct": 62.13 },
        "WP": { "votePct": 37.87 }
      }
    },
    "BUKIT PANJANG SMC": {
      "winnerParty": "PAP",
      "constituencyType": "SMC",
      "parties": {
        "PAP": { "votePct": 54.02 },
        "PSP": { "votePct": 45.98 }
      }
    }
  }
}
```

---
