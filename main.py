from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from llm import llm
from trial_finder import filter_conditions, filter_unmatched_trials, filter_on_answer, get_next_question
from typing import List, Mapping
import pandas as pd

class Conversation(BaseModel):
    # messages: List[Mapping[str, str]]
    message: str
    status: str

class PatientCondition(BaseModel):
    condition: str

class PatientAnswer(BaseModel):
    question: str
    answer: str

app = FastAPI()
origins = [
    "http://localhost:5173",  # local dev
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

df_trials = pd.read_csv("../data/refined_trials.csv")
df_cfg_parsed_trials = pd.read_csv(
    "../data/cfg_parsed_clinical_trials.tsv", sep="\t"
)

df_available_trials = df_trials
df_cfg_parsed_available_trials = df_cfg_parsed_trials
condition = None

questions_asked = []

@app.post("/set_condition")
def set_condition(patient_condition: PatientCondition):
    clean_condition = llm.predict(f"Extract and derive the condition name to it's main cancer type. The output should be the cancer name in lower case and nothing else: {patient_condition.condition}").strip("\n")
    global df_available_trials, df_cfg_parsed_available_trials
    df_available_trials = filter_conditions(df_trials, clean_condition)
    df_cfg_parsed_available_trials = filter_unmatched_trials(
        df_cfg_parsed_trials, df_available_trials
    )
    return {"message": "Condition set."}

@app.get("/get_question")
def get_question():
    if len(df_available_trials) > 3:
        next_question = get_next_question(
            df_available_trials, df_cfg_parsed_trials, questions_asked
        )
        questions_asked.append(next_question)
        return {"question": next_question}
    else:
        return {"message": "Enough data collected"}

@app.post("/send_answer")
def send_answer(patient_answer: PatientAnswer):
    global df_available_trials, df_cfg_parsed_available_trials
    filtered_ids = filter_on_answer(
        df_cfg_parsed_available_trials, patient_answer.question, patient_answer.answer
    )
    df_available_trials = df_available_trials[df_available_trials["#nct_id"].isin(filtered_ids)]
    df_cfg_parsed_available_trials = filter_unmatched_trials(
        df_cfg_parsed_available_trials, df_available_trials
    )
    return {"message": "Answer recorded."}

@app.get("/get_trials")
def get_trials():
    return {"trials": list(df_available_trials['#nct_id'])}

@app.post("/")
def read_root(conversation: Conversation):
    if conversation.status == "initial":
        return {"message": "What is your condition?"}
    else:
        return {"message": llm.predict(conversation.message)}