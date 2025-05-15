namespace loja;
using { cuid, managed } from '@sap/cds/common';

entity Products: cuid, managed {
  name: String not null;
  description: String;
  price: Double;
  cust: Double;

}