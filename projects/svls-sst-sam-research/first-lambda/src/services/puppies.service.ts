export interface Puppy {
  name: string;
  gender: string;
  breed: string;
  age: string;
}

const puppies: Puppy[] = [{
  "name": "Hank",
  "gender": "male",
  "breed": "Mastiff",
  "age": "4yrs"
}];

export function getPuppies(): Puppy[] {
  return puppies;
}
