export const getOrderData = async (id, admin) => {
    try {
        const orderQuery = await admin.graphql(
          `#graphql
            query orderDetails($id: ID!) {
              order(id: $id) {
                fulfillmentOrders(first: 1) {
                  edges {
                    node {
                      assignedLocation {
                        countryCode
                        zip
                        location {
                          id
                          address {
                            address1
                            address2
                            city
                            country
                            zip
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          `,
          {
            variables: {
              id,
            },
          },
        );
      
        const { data } = await orderQuery.json();
        const order = data.order.fulfillmentOrders.edges[0].node;
        console.log("order", order);
        return order;
    } catch(e) {
        console.log('error', e);
    }
}