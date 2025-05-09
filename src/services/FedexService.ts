import axios from 'axios';

export class FedexService {
  private baseUrl = 'https://apis-sandbox.fedex.com';

  async getRates(data: any) {
    const response = await axios.post(`${this.baseUrl}/rate/v1/rates/quotes`, data, {
      headers: {
        'Authorization': `Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzY29wZSI6WyJDWFMtVFAiXSwiUGF5bG9hZCI6eyJjbGllbnRJZGVudGl0eSI6eyJjbGllbnRLZXkiOiJsNzFlZTA5YTk3MzY4NDQyMWI4M2ZjMjhlMTFhZmY1ZTY0In0sImF1dGhlbnRpY2F0aW9uUmVhbG0iOiJDTUFDIiwiYWRkaXRpb25hbElkZW50aXR5Ijp7InRpbWVTdGFtcCI6IjEzLU5vdi0yMDI0IDA0OjUwOjA1IEVTVCIsImdyYW50X3R5cGUiOiJjbGllbnRfY3JlZGVudGlhbHMiLCJhcGltb2RlIjoiU2FuZGJveCIsImN4c0lzcyI6Imh0dHBzOi8vY3hzYXV0aHNlcnZlci1zdGFnaW5nLmFwcC5wYWFzLmZlZGV4LmNvbS90b2tlbi9vYXV0aDIifSwicGVyc29uYVR5cGUiOiJEaXJlY3RJbnRlZ3JhdG9yX0IyQiJ9LCJleHAiOjE3MzE0OTUwMDUsImp0aSI6IjBjNmZiMzAwLTY5YmItNGU0ZS1iZTUwLWE5MmM0ZDZhMmZmNCJ9.cQ96XVZf-IwPkzWD0UGwsAMbMrxox2gDLNJI_HwJ9KWNIp5uY4RrqayJnUmNAe22o393lVj-kkDFidZ7QCUfPH0VoOeaVI2H4Der3XVQGqM_-wmoIIIx8EER2EOMHwzX11ce4GLyLDNMxZKWtNgcgvxGeklw6W56gQLj2FhrvikJTYWfJsZC70z4ilmYq6QV9kBP4pdy1F9CIHGd6tCzzUqeAOUmj1hZ-NJu4XGWBJsAmPv4uruXh5cV1ZCM3UKYKE_XI0XU9zTaN-ZEz4pMJczCG77C_TajwYBT40tnBlyH05Yc1ZEM-RwoLsEFPbVI2Uvv16thzLRpWIl_UD7Co4Nx8vyYxsiDGi32drU_KOxQDjnsZ8Myogiaehdq1LVk8f1DBnaC6sVcp09-qjllh_fn0HzjtyZMSs_LaKaZQ9qak8n65bZ2MHWV8te8vD8M5WcFwPhPBsynaYqPNaZV6cdjorL7iuLi04YVcIrvev5znjSvRpYwGxpk85mIt54sUZebwqhKPG8iwGCRUV4-v9S6VvRkUwnkgH47n0khfj04j-5Hzg8-ctNlkzjIhMu1L776eGkeQIPAsZ2IgMuqZ33ortb014FGksWgXkS2Wno99-lwHWlwFaPKnNzDVbzYqonmgnehCDfpAP_eoc9NRfZ-N-A-r0I5e5PU7CgkHvo`
      }
    });
    return response.data;
  }
} 